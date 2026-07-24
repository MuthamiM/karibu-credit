from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Response, status
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.security import get_password_hash, verify_password
from app.core.audit import log_audit_event
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, UserUpdate, PasswordChangeRequest, PhoneUpdateRequest

router = APIRouter()



@router.post("/admin", response_model=UserResponse)
async def create_admin_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
    current_user: User = Depends(deps.get_current_super_admin),
):
    """
    Create a new admin/worker.
    Only users with the 'SUPER_ADMIN' role can invoke this endpoint to create another admin or staff member.
    """
    # Check if a user with this email already exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists in the system.",
        )
        
    db_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        phone_number=user_in.phone_number,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role, # Role sent by super admin
        is_active=True
    )
    
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    await log_audit_event(
        db,
        user=current_user.email,
        action="CREATE_ADMIN",
        details=f"Created administrative user {db_user.email} (Role: {db_user.role})"
    )
    return db_user

@router.post("/customer", response_model=UserResponse)
async def create_customer(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
    current_user: User = Depends(deps.get_current_active_user),
):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A customer with this email already exists",
        )
    
    db_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        phone_number=user_in.phone_number,
        hashed_password=get_password_hash(user_in.password),
        role=UserRole.BORROWER,
        is_active=True
    )
    
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    # Automatically create the Customer profile record
    from app.models.customer import Customer, KycStatus
    import random
    customer_code = f"KC-{random.randint(10000000, 99999999)}"
    db_customer = Customer(
        customer_code=customer_code,
        user_id=db_user.id,
        national_id=f"PENDING-{customer_code}",
        full_name=db_user.full_name,
        phone=db_user.phone_number or f"PENDING-{customer_code}",
        kyc_status=KycStatus.PENDING,
        credit_score=0,
        max_loan_limit=0.0,
        is_repeat_borrower=False
    )
    db.add(db_customer)
    await db.commit()

    await log_audit_event(
        db,
        user=current_user.email,
        action="ONBOARD_BORROWER",
        details=f"Registered borrower customer profile: {db_user.email} (Customer Code: {customer_code})"
    )
    return db_user


@router.get("/", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100,
    role: UserRole | None = None
):
    query = select(User)
    if role:
        # The database stores UserRole as the enum member name, so normalize here.
        if isinstance(role, UserRole):
            role_name = role.name
        else:
            role_str = str(role)
            try:
                role_enum = UserRole(role_str)
            except ValueError:
                try:
                    role_enum = UserRole[role_str]
                except (KeyError, ValueError):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid role: {role_str}",
                    )
            role_name = role_enum.name
        query = query.where(User.role == role_name)
    result = await db.execute(query.offset(skip).limit(limit))
    return list(result.scalars().all())

@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Get current logged in user profile.
    """
    return current_user

@router.put("/me/password", response_model=dict)
async def change_current_user_password(
    *,
    db: AsyncSession = Depends(get_db),
    body: PasswordChangeRequest,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Change password for the currently authenticated user.
    """
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed",
        )
    
    current_user.hashed_password = get_password_hash(body.new_password)
    db.add(current_user)
    await db.commit()
    
    await log_audit_event(
        db,
        user=current_user.email,
        action="CHANGE_PASSWORD",
        details=f"User {current_user.email} updated their account security password."
    )
    return {"status": "success", "detail": "Password updated successfully"}

@router.put("/me/phone", response_model=UserResponse)
async def update_current_user_phone(
    *,
    db: AsyncSession = Depends(get_db),
    body: PhoneUpdateRequest,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Update target phone number for OTP delivery for current user.
    """
    clean_phone = body.phone_number.strip().replace(" ", "").replace("-", "").replace("+", "")
    if (clean_phone.startswith("07") or clean_phone.startswith("01")) and len(clean_phone) == 10:
        clean_phone = f"254{clean_phone[1:]}"
    
    current_user.phone_number = clean_phone
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    await log_audit_event(
        db,
        user=current_user.email,
        action="UPDATE_PHONE_OTP",
        details=f"User {current_user.email} updated OTP target phone to {clean_phone}"
    )
    return current_user


@router.get("/export")
async def export_borrowers_excel(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(deps.get_token_from_header_or_query),
    skip: int = 0,
    limit: int = 100,
    role: UserRole | None = None,
):
    current_user = await deps.get_current_user(db=db, token=token)
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    query = select(User)
    if role:
        if isinstance(role, UserRole):
            role_name = role.name
        else:
            role_str = str(role)
            try:
                role_enum = UserRole(role_str)
            except ValueError:
                try:
                    role_enum = UserRole[role_str]
                except (KeyError, ValueError):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid role: {role_str}",
                    )
            role_name = role_enum.name
        query = query.where(User.role == role_name)

    result = await db.execute(query.offset(skip).limit(limit))
    users = list(result.scalars().all())
    user_ids = [user.id for user in users]

    if user_ids:
        from app.models.loan import Loan, LoanStatus

        loan_result = await db.execute(
            select(Loan).where(Loan.user_id.in_(user_ids)).options(selectinload(Loan.customer))
        )
        loans = list(loan_result.scalars().all())
    else:
        loans = []

    header = [
        'Borrower ID',
        'Full Name',
        'Email',
        'Phone Number',
        'Active',
        'Borrower Total Principal',
        'Borrower Total Repaid',
        'Borrower Total Outstanding',
        'Borrower Loan Count',
        'Borrower Profit',
        'Borrower Loss',
        'Loan ID',
        'Application No',
        'Product Type',
        'Status',
        'Principal Amount',
        'Total Paid',
        'Total Payable',
        'Outstanding Balance',
        'Tenure Months',
        'Created At',
        'Days Since Disbursement',
        'Age Category',
        'Cleared',
        'Delinquent',
        'Loan Profit',
        'Customer Code',
        'Customer National ID',
    ]

    loans_by_user: dict[int, list] = {}
    for loan in loans:
        loans_by_user.setdefault(loan.user_id, []).append(loan)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = 'Borrowers Export'
    sheet.append(header)

    now_utc = datetime.now(timezone.utc)

    for user in users:
        borrower_loans = loans_by_user.get(user.id, [])
        borrower_total_principal = sum((loan.principal_amount or 0) for loan in borrower_loans)
        borrower_total_repaid = sum((loan.total_paid or 0) for loan in borrower_loans)
        borrower_total_outstanding = sum((loan.outstanding_balance or 0) for loan in borrower_loans)
        borrower_loan_count = len(borrower_loans)
        borrower_profit = sum(((loan.total_paid or 0) - (loan.principal_amount or 0)) for loan in borrower_loans)
        borrower_loss = sum(
            (loan.outstanding_balance or 0)
            for loan in borrower_loans
            if loan.status in (LoanStatus.DEFAULTED, LoanStatus.WRITTEN_OFF) or (loan.status == LoanStatus.CLOSED and (loan.outstanding_balance or 0) > 0)
        )

        if not borrower_loans:
            sheet.append([
                user.id,
                user.full_name,
                user.email,
                user.phone_number or '',
                'Yes' if user.is_active else 'No',
                borrower_total_principal,
                borrower_total_repaid,
                borrower_total_outstanding,
                borrower_loan_count,
                borrower_profit,
                borrower_loss,
                '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            ])
            continue

        for loan in borrower_loans:
            created_at = loan.created_at
            days_since = ''
            age_category = ''
            if created_at:
                if created_at.tzinfo is not None:
                    delta = now_utc - created_at.astimezone(timezone.utc)
                else:
                    delta = datetime.now() - created_at
                days_since = delta.days
                if days_since <= 30:
                    age_category = 'Recent (<=30d)'
                elif days_since <= 180:
                    age_category = 'Medium (31-180d)'
                else:
                    age_category = 'Old (>180d)'

            status_text = loan.status.value if hasattr(loan.status, 'value') else str(loan.status or '')
            cleared = loan.status in (LoanStatus.CLEARED, LoanStatus.CLOSED)
            delinquent = not cleared and (loan.outstanding_balance or 0) > 0 and (isinstance(days_since, int) and days_since > 30)
            loan_profit = (loan.total_paid or 0) - (loan.principal_amount or 0)

            sheet.append([
                user.id,
                user.full_name,
                user.email,
                user.phone_number or '',
                'Yes' if user.is_active else 'No',
                borrower_total_principal,
                borrower_total_repaid,
                borrower_total_outstanding,
                borrower_loan_count,
                borrower_profit,
                borrower_loss,
                loan.id,
                loan.application_no or '',
                loan.product_type or '',
                status_text,
                loan.principal_amount or 0,
                loan.total_paid or 0,
                loan.total_payable if loan.total_payable is not None else '',
                loan.outstanding_balance or 0,
                loan.tenure_months or '',
                created_at,
                days_since,
                age_category,
                'Yes' if cleared else 'No',
                'Yes' if delinquent else 'No',
                loan_profit,
                loan.customer.customer_code if loan.customer else '',
                loan.customer.national_id if loan.customer else '',
            ])

    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    headers = {
        'Content-Disposition': 'attachment; filename="karibu-borrowers-detailed-export.xlsx"',
    }
    return Response(
        content=output.getvalue(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers=headers,
    )
