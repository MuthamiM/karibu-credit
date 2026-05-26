from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import uuid
from datetime import datetime
from dateutil.relativedelta import relativedelta

from app.api import deps
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.loan import Loan, LoanStatus, Transaction, TransactionType, DisbursementMethod, Collateral
from app.schemas.loan import LoanCreate, LoanCreateAdmin, LoanResponse, AmortizationScheduleInfo, DisbursementRequest, CRBCheckRequest, CRBCheckResponse, CollateralCreate, CollateralResponse
from app.core import loan_engine
from app.core.audit import log_audit_event
from app.integrations.kcb import KCBGateway

router = APIRouter()

# Instantiate KCB Gateway Service
kcb_gateway = KCBGateway()

@router.post("/apply", response_model=LoanResponse)
async def apply_for_loan(
    loan_in: LoanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Customers / Agents use this to apply for a loan (Logbook, SME, etc).
    The loan remains 'pending' until evaluated by a Loan Officer / Finance team.
    """
    # Flat rate interest depending on product - mocked at standard 5% per month for this example.
    interest_rate = 5.0 
    
    db_loan = Loan(
        user_id=current_user.id,
        principal_amount=loan_in.principal_amount,
        interest_rate=interest_rate,
        tenure_months=loan_in.tenure_months,
        product_type=loan_in.product_type,
        disbursement_method=loan_in.disbursement_method,
        status=LoanStatus.PENDING
    )
    
    db.add(db_loan)
    await db.commit()
    await db.refresh(db_loan)
    await log_audit_event(
        db,
        user=current_user.email,
        action="APPLY_LOAN",
        details=f"Applied for loan ID #{db_loan.id} of KES {db_loan.principal_amount}"
    )
    return db_loan


@router.post("/", response_model=LoanResponse)
async def create_loan_admin(
    loan_in: LoanCreateAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Admins / Loan Officers use this to create a loan on behalf of a borrower/customer.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You are not authorized to create loans."
        )
        
    # Verify the borrower exists in the database
    result = await db.execute(select(User).where(User.id == loan_in.borrower_id))
    borrower = result.scalars().first()
    if not borrower:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Borrower with ID {loan_in.borrower_id} not found."
        )
        
    db_loan = Loan(
        user_id=loan_in.borrower_id,
        principal_amount=loan_in.principal_amount,
        interest_rate=loan_in.interest_rate,
        tenure_months=loan_in.term_months,
        product_type=loan_in.loan_type.lower(),
        disbursement_method=loan_in.disbursement_method,
        status=LoanStatus.PENDING
    )
    
    db.add(db_loan)
    await db.commit()
    await db.refresh(db_loan)
    await log_audit_event(
        db,
        user=current_user.email,
        action="CREATE_LOAN_ADMIN",
        details=f"Created loan ID #{db_loan.id} for Borrower ID #{loan_in.borrower_id} of KES {db_loan.principal_amount}"
    )
    return db_loan



@router.get("/{loan_id}/schedule", response_model=AmortizationScheduleInfo)
async def get_loan_schedule(
    loan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Review the amortization schedule (total interest & monthly payments) before approval.
    """
    result = await db.execute(select(Loan).where(Loan.id == loan_id))
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    schedule = loan_engine.calculate_flat_rate_schedule(
        principal=loan.principal_amount,
        monthly_rate_pct=loan.interest_rate,
        months=loan.tenure_months
    )
    return schedule


@router.post("/{loan_id}/approve", response_model=LoanResponse)
async def approve_loan(
    loan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Approve loans (Restricted to Loan Officers & Finance Team).
    If it's a LUMP_SUM loan, it immediately triggers the KCB API to DISBURSE full funds to the client.
    If it's PARTIAL or STAGE_WISE, it marks the loan as APPROVED but requires explicit separate disbursement calls.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You are not authorized to approve loans."
        )
        
    result = await db.execute(select(Loan).where(Loan.id == loan_id))
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    if loan.status != LoanStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending loans can be approved")
        
    # Setup repayment terms
    schedule = loan_engine.calculate_flat_rate_schedule(
        principal=loan.principal_amount,
        monthly_rate_pct=loan.interest_rate,
        months=loan.tenure_months
    )
    loan.total_payable = schedule["total_payable"]
    # Add tenure_months to current time
    loan.due_date = datetime.now() + relativedelta(months=loan.tenure_months)
    loan.status = LoanStatus.APPROVED
    
    if loan.disbursement_method == DisbursementMethod.LUMP_SUM:
        # Generate unique 8-character reference for bank integration
        ref = str(uuid.uuid4())[:8].upper()
        account_target = current_user.phone_number or "0700000000" 
        
        disbursement_resp = await kcb_gateway.disburse_loan(
            account_no=account_target,
            amount=loan.principal_amount,
            reference=ref
        )
        
        if disbursement_resp["status"] == "success":
            loan.status = LoanStatus.DISBURSED
            loan.amount_disbursed = loan.principal_amount
            loan.kcb_reference = disbursement_resp["kcb_transaction_id"]
            
            trx = Transaction(
                loan_id=loan.id,
                type=TransactionType.DISBURSEMENT,
                amount=loan.principal_amount,
                reference_code=loan.kcb_reference
            )
            db.add(trx)
            
            # Platform fee: KES 10 per disbursement transaction
            fee_trx = Transaction(
                loan_id=loan.id,
                type=TransactionType.PLATFORM_FEE,
                amount=10.0,
                reference_code=f"FEE-{loan.kcb_reference}"
            )
            db.add(fee_trx)
        
    await db.commit()
    await db.refresh(loan)
    await log_audit_event(
        db,
        user=current_user.email,
        action="APPROVE_LOAN",
        details=f"Approved loan ID #{loan.id} (Status: {loan.status})"
    )
    return loan

@router.post("/{loan_id}/disburse_tranche", response_model=LoanResponse)
async def disburse_tranche(
    loan_id: int,
    payload: DisbursementRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Manually push a tranche/partial disbursement for STAGE_WISE or PARTIAL loan types.
    """
    if current_user.role not in [UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    result = await db.execute(select(Loan).where(Loan.id == loan_id))
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    if loan.disbursement_method == DisbursementMethod.LUMP_SUM:
        raise HTTPException(status_code=400, detail="Lump sum loans are disbursed automatically upon approval")
        
    if loan.status not in [LoanStatus.APPROVED, LoanStatus.PARTIALLY_DISBURSED]:
        raise HTTPException(status_code=400, detail="Loan is not in a state to be disbursed")
        
    if loan.amount_disbursed + payload.amount > loan.principal_amount:
        raise HTTPException(status_code=400, detail="Cannot disburse more than the approved principal amount")
        
    ref = str(uuid.uuid4())[:8].upper()
    account_target = loan.user.phone_number if loan.user else "0700000000"
    
    # Process through KCB integration
    disbursement_resp = await kcb_gateway.disburse_loan(
        account_no=account_target,
        amount=payload.amount,
        reference=ref
    )
    
    if disbursement_resp["status"] == "success":
        loan.amount_disbursed += payload.amount
        loan.kcb_reference = disbursement_resp["kcb_transaction_id"]
        
        if loan.amount_disbursed >= loan.principal_amount:
            loan.status = LoanStatus.DISBURSED
        else:
            loan.status = LoanStatus.PARTIALLY_DISBURSED
            
        trx = Transaction(
            loan_id=loan.id,
            type=TransactionType.DISBURSEMENT,
            amount=payload.amount,
            reference_code=loan.kcb_reference
        )
        db.add(trx)
        
        # Platform fee: KES 10 per tranche disbursement
        fee_trx = Transaction(
            loan_id=loan.id,
            type=TransactionType.PLATFORM_FEE,
            amount=10.0,
            reference_code=f"FEE-{loan.kcb_reference}"
        )
        db.add(fee_trx)
        
        await db.commit()
        await db.refresh(loan)
        await log_audit_event(
            db,
            user=current_user.email,
            action="DISBURSE_TRANCHE",
            details=f"Disbursed tranche of KES {payload.amount} for loan ID #{loan.id}"
        )
        
    return loan

@router.post("/{loan_id}/reject", response_model=LoanResponse)
async def reject_loan(
    loan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Reject loans (Restricted to Loan Officers & Finance Team).
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You are not authorized to reject loans."
        )
        
    result = await db.execute(select(Loan).where(Loan.id == loan_id))
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    if loan.status != LoanStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending loans can be rejected")
    
    loan.status = LoanStatus.REJECTED
    await db.commit()
    await db.refresh(loan)
    await log_audit_event(
        db,
        user=current_user.email,
        action="REJECT_LOAN",
        details=f"Rejected loan ID #{loan.id}"
    )
    return loan

@router.get("/stats")
async def get_loan_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Dashboard Analytics. Returns total disbursed, total expected, and total default amounts.
    Restricted to Finance and Super Admin.
    """
    if current_user.role not in [UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You are not authorized to view global statistics."
        )

    # 1. Total Principal Disbursed
    res_disbursed = await db.execute(
        select(func.sum(Loan.principal_amount))
        .where(Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLEARED, LoanStatus.DEFAULTED]))
    )
    total_disbursed = res_disbursed.scalar() or 0.0

    # 2. Total Expected Revenue (Principal + Interest)
    res_expected = await db.execute(
        select(func.sum(Loan.total_payable))
        .where(Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLEARED, LoanStatus.DEFAULTED]))
    )
    total_expected = res_expected.scalar() or 0.0

    # 3. Total Amount Repaid
    res_repaid = await db.execute(
        select(func.sum(Loan.total_paid))
        .where(Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLEARED, LoanStatus.DEFAULTED]))
    )
    total_repaid = res_repaid.scalar() or 0.0

    # 4. Total Amount in Default (Outstanding balances of defaulted loans)
    res_defaulted = await db.execute(
        select(func.sum(Loan.total_payable - Loan.total_paid + Loan.penalty_balance))
        .where(Loan.status == LoanStatus.DEFAULTED)
    )
    total_defaulted_value = res_defaulted.scalar() or 0.0

    # 5. Total Transaction Fees (KES 10 per repayment or disbursement, stored as PLATFORM_FEE rows)
    res_tx = await db.execute(
        select(func.sum(Transaction.amount))
        .where(Transaction.type == TransactionType.PLATFORM_FEE)
    )
    total_fees = res_tx.scalar() or 0.0

    return {
        "total_disbursed": total_disbursed,
        "total_expected_revenue": total_expected,
        "total_repaid": total_repaid,
        "total_defaulted_value": total_defaulted_value,
        "total_outstanding_value": (total_expected - total_repaid),
        "total_fees": total_fees
    }

@router.get("/me", response_model=list[LoanResponse])
async def get_my_loans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Fetch all loans associated with the current logged-in customer.
    """
    result = await db.execute(select(Loan).where(Loan.user_id == current_user.id).order_by(Loan.created_at.desc()))
    return result.scalars().all()

@router.get("/", response_model=list[LoanResponse])
async def get_all_loans(
    status_filter: LoanStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Fetch all loans (Restricted to Loan Officers & Finance Team).
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You are not authorized to view all loans."
        )
        
    query = select(Loan)
    if status_filter:
        query = query.where(Loan.status == status_filter)
        
    query = query.order_by(Loan.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/crb-check", response_model=CRBCheckResponse)
async def crb_check(
    payload: CRBCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Mock CRB (Credit Reference Bureau) lookup.
    In production this would call Metropol / TransUnion APIs.
    """
    import random
    score = random.randint(450, 800)
    grading = "Good"
    if score < 550:
        grading = "High Risk (Default History)"
    elif score < 700:
        grading = "Fair / Moderate Risk"

    listings = 2 if score < 550 else 0
    amount_listed = "KES 42,500" if listings > 0 else "KES 0"
    report_id = f"MET_RPT_{random.randint(100000, 999999)}"

    await log_audit_event(
        db,
        user=current_user.email,
        action="CRB_CHECK",
        details=f"Queried CRB for National ID {payload.national_id}. Score: {score}"
    )

    return CRBCheckResponse(
        national_id=payload.national_id,
        score=score,
        grading=grading,
        listings=listings,
        amount_listed=amount_listed,
        report_id=report_id,
        timestamp=datetime.now()
    )


@router.get("/transactions")
async def get_all_transactions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    limit: int = 50,
    tx_type: TransactionType | None = None
):
    """
    List recent transactions (repayments, disbursements, fees).
    Used by C2B Monitor and B2C Payout dashboards.
    """
    if current_user.role not in [UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.LOAN_OFFICER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view transactions."
        )

    query = select(Transaction)
    if tx_type:
        query = query.where(Transaction.type == tx_type)
    query = query.order_by(Transaction.created_at.desc()).limit(limit)
    result = await db.execute(query)
    rows = result.scalars().all()

    return [
        {
            "id": t.id,
            "loan_id": t.loan_id,
            "type": t.type.value,
            "amount": t.amount,
            "reference_code": t.reference_code,
            "created_at": t.created_at.isoformat() if t.created_at else None
        }
        for t in rows
    ]


@router.get("/collateral", response_model=list[dict])
async def get_all_collateral(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get all collateral records.
    Restricted to Loan Officers, Finance, and Admins.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view collateral."
        )
    
    from sqlalchemy.orm import selectinload
    query = select(Collateral).options(selectinload(Collateral.loan).selectinload(Loan.user)).order_by(Collateral.created_at.desc())
    result = await db.execute(query)
    rows = result.scalars().all()
    
    return [
        {
            "id": f"COL-{c.id}",
            "loan_id": c.loan_id,
            "borrower": c.loan.user.full_name if (c.loan and c.loan.user) else "Unknown Borrower",
            "type": c.type,
            "value": c.value,
            "status": c.status,
            "details": c.details or ""
        }
        for c in rows
    ]


@router.post("/{loan_id}/collateral", response_model=CollateralResponse)
async def attach_collateral(
    loan_id: int,
    payload: CollateralCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Attach collateral to a loan.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to attach collateral."
        )
    
    # Check if loan exists
    result = await db.execute(select(Loan).where(Loan.id == loan_id))
    loan = result.scalars().first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    collateral_item = Collateral(
        loan_id=loan.id,
        type=payload.type,
        value=payload.value,
        status=payload.status or "PENDING",
        details=payload.details
    )
    db.add(collateral_item)
    await db.commit()
    await db.refresh(collateral_item)
    
    await log_audit_event(
        db,
        user=current_user.email,
        action="ATTACH_COLLATERAL",
        details=f"Attached collateral {payload.type} (Valued KES {payload.value}) to Loan ID #{loan.id}"
    )
    
    return collateral_item

