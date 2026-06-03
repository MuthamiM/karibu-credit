from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
import random
from datetime import datetime

from app.api import deps
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.customer import Customer
from app.models.group import LendingGroup, GroupMember, GroupLoan, GroupStatus, GroupMemberRole, GroupLoanStatus
from app.schemas.group import (
    GroupCreate, GroupJoin, GroupLoanApply,
    GroupResponse, GroupMemberResponse, GroupLoanResponse
)
from app.core import loan_engine
from app.core.audit import log_audit_event

router = APIRouter()


@router.post("/create", response_model=GroupResponse)
async def create_group(
    payload: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Create a new joint liability lending group.
    Restricted to Loan Officers, Branch Managers, and Admins.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to create lending groups."
        )

    group_code = f"GRP-{random.randint(100000000, 999999999)}"

    group = LendingGroup(
        group_code=group_code,
        group_name=payload.group_name,
        description=payload.description,
        branch_id=payload.branch_id,
        max_members=payload.max_members,
        status=GroupStatus.ACTIVE,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)

    await log_audit_event(
        db,
        user=current_user.email,
        action="CREATE_GROUP",
        details=f"Created lending group '{payload.group_name}' (Code: {group_code})"
    )

    return GroupResponse(
        id=group.id,
        group_code=group.group_code,
        group_name=group.group_name,
        description=group.description,
        chairman_user_id=group.chairman_user_id,
        branch_id=group.branch_id,
        status=group.status,
        max_members=group.max_members,
        created_at=group.created_at,
        member_count=0,
        total_loans=0,
    )


@router.post("/join", response_model=GroupMemberResponse)
async def join_group(
    payload: GroupJoin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Add a borrower/customer to a lending group.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to manage group membership."
        )

    # Verify group exists and is active
    result = await db.execute(
        select(LendingGroup)
        .options(selectinload(LendingGroup.members))
        .where(LendingGroup.id == payload.group_id)
    )
    group = result.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Lending group not found")
    if group.status != GroupStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Group is not active")

    # Check member limit
    active_members = [m for m in group.members if m.is_active]
    if len(active_members) >= group.max_members:
        raise HTTPException(status_code=400, detail=f"Group has reached maximum capacity of {group.max_members} members")

    # Verify customer exists
    cust_result = await db.execute(select(Customer).where(Customer.id == payload.customer_id))
    customer = cust_result.scalars().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Check for duplicate membership
    existing = [m for m in group.members if m.customer_id == payload.customer_id and m.is_active]
    if existing:
        raise HTTPException(status_code=400, detail="Customer is already a member of this group")

    member = GroupMember(
        group_id=group.id,
        customer_id=customer.id,
        role=payload.role,
        is_active=True,
    )
    db.add(member)

    # If this is the chairman, update the group's chairman reference
    if payload.role == GroupMemberRole.CHAIRMAN and customer.user_id:
        group.chairman_user_id = customer.user_id

    await db.commit()
    await db.refresh(member)

    await log_audit_event(
        db,
        user=current_user.email,
        action="JOIN_GROUP",
        details=f"Added customer #{customer.id} ({customer.full_name}) to group '{group.group_name}' as {payload.role.value}"
    )

    return GroupMemberResponse(
        id=member.id,
        group_id=member.group_id,
        customer_id=member.customer_id,
        role=member.role,
        is_active=member.is_active,
        joined_at=member.joined_at,
        customer_name=customer.full_name,
    )


@router.post("/apply", response_model=GroupLoanResponse)
async def apply_group_loan(
    payload: GroupLoanApply,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Submit a group loan application under joint liability.
    The principal is distributed equally among active group members.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to submit group loan applications."
        )

    # Verify group exists, is active, and has at least 3 members
    result = await db.execute(
        select(LendingGroup)
        .options(selectinload(LendingGroup.members))
        .where(LendingGroup.id == payload.group_id)
    )
    group = result.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Lending group not found")
    if group.status != GroupStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Group is not active")

    active_members = [m for m in group.members if m.is_active]
    if len(active_members) < 3:
        raise HTTPException(
            status_code=400,
            detail=f"Group must have at least 3 active members to apply for a loan. Currently has {len(active_members)}."
        )

    # Check for existing active group loans
    existing_loans_result = await db.execute(
        select(GroupLoan)
        .where(GroupLoan.group_id == group.id)
        .where(GroupLoan.status.in_([GroupLoanStatus.PENDING, GroupLoanStatus.DISBURSED, GroupLoanStatus.ACTIVE]))
    )
    existing_active = existing_loans_result.scalars().all()
    if existing_active:
        raise HTTPException(
            status_code=400,
            detail="Group already has an active or pending loan. Clear existing obligations first."
        )

    app_no = f"GLA-{random.randint(100000000, 999999999)}"

    # Calculate schedule using flat rate (simple for group loans)
    schedule = loan_engine.calculate_flat_rate_schedule(
        principal=payload.principal_amount,
        monthly_rate_pct=payload.interest_rate,
        months=payload.tenure_months,
    )

    group_loan = GroupLoan(
        group_id=group.id,
        application_no=app_no,
        principal_amount=payload.principal_amount,
        interest_rate=payload.interest_rate,
        tenure_months=payload.tenure_months,
        total_payable=schedule["total_payable"],
        total_paid=0.0,
        outstanding_balance=schedule["total_payable"],
        status=GroupLoanStatus.PENDING,
        purpose=payload.purpose,
    )
    db.add(group_loan)
    await db.commit()
    await db.refresh(group_loan)

    await log_audit_event(
        db,
        user=current_user.email,
        action="GROUP_LOAN_APPLY",
        details=f"Group loan application {app_no} for '{group.group_name}' — KES {payload.principal_amount:,.2f} over {payload.tenure_months} months"
    )

    return group_loan


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group_details(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Fetch a lending group's full details including members and loan history.
    """
    result = await db.execute(
        select(LendingGroup)
        .options(
            selectinload(LendingGroup.members).selectinload(GroupMember.customer),
            selectinload(LendingGroup.group_loans),
        )
        .where(LendingGroup.id == group_id)
    )
    group = result.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Lending group not found")

    members_out = [
        GroupMemberResponse(
            id=m.id,
            group_id=m.group_id,
            customer_id=m.customer_id,
            role=m.role,
            is_active=m.is_active,
            joined_at=m.joined_at,
            customer_name=m.customer.full_name if m.customer else None,
        )
        for m in group.members
    ]

    loans_out = [
        GroupLoanResponse(
            id=gl.id,
            group_id=gl.group_id,
            application_no=gl.application_no,
            principal_amount=gl.principal_amount,
            interest_rate=gl.interest_rate,
            tenure_months=gl.tenure_months,
            total_payable=gl.total_payable,
            total_paid=gl.total_paid,
            outstanding_balance=gl.outstanding_balance,
            status=gl.status,
            purpose=gl.purpose,
            approved_by=gl.approved_by,
            disbursed_at=gl.disbursed_at,
            created_at=gl.created_at,
        )
        for gl in group.group_loans
    ]

    return GroupResponse(
        id=group.id,
        group_code=group.group_code,
        group_name=group.group_name,
        description=group.description,
        chairman_user_id=group.chairman_user_id,
        branch_id=group.branch_id,
        status=group.status,
        max_members=group.max_members,
        created_at=group.created_at,
        member_count=len([m for m in group.members if m.is_active]),
        total_loans=len(group.group_loans),
        members=members_out,
        group_loans=loans_out,
    )


@router.get("/", response_model=list[GroupResponse])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    List all lending groups with summary metrics.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.BRANCH_MANAGER, UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view lending groups."
        )

    result = await db.execute(
        select(LendingGroup)
        .options(
            selectinload(LendingGroup.members),
            selectinload(LendingGroup.group_loans),
        )
        .order_by(LendingGroup.created_at.desc())
    )
    groups = result.scalars().all()

    return [
        GroupResponse(
            id=g.id,
            group_code=g.group_code,
            group_name=g.group_name,
            description=g.description,
            chairman_user_id=g.chairman_user_id,
            branch_id=g.branch_id,
            status=g.status,
            max_members=g.max_members,
            created_at=g.created_at,
            member_count=len([m for m in g.members if m.is_active]),
            total_loans=len(g.group_loans),
        )
        for g in groups
    ]
