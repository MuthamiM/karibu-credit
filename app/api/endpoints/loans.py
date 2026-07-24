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
from app.models.customer import Customer
from app.models.loan_product import LoanProduct, InterestMethod
from app.models.loan import Loan, LoanStatus, Transaction, TransactionType, DisbursementMethod, Collateral
from app.schemas.loan import LoanCreate, LoanCreateAdmin, LoanResponse, AmortizationScheduleInfo, DisbursementRequest, CRBCheckRequest, CRBCheckResponse, CollateralCreate, CollateralResponse
from app.core import loan_engine
from app.core.audit import log_audit_event
from app.integrations.kcb import KCBGateway

router = APIRouter()

# Instantiate KCB Gateway Service
kcb_gateway = KCBGateway()


async def get_loan_with_relations(db: AsyncSession, loan_id: int) -> Loan:
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Loan)
        .options(
            selectinload(Loan.customer),
            selectinload(Loan.product),
            selectinload(Loan.branch),
            selectinload(Loan.repayment_schedules)
        )
        .where(Loan.id == loan_id)
    )
    return result.scalars().first()

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
    normalized_type = loan_in.product_type.upper()
    product_result = await db.execute(
        select(LoanProduct).where(LoanProduct.type == normalized_type, LoanProduct.is_active == True)
    )
    product = product_result.scalars().first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Loan product type '{loan_in.product_type}' is not active or not supported."
        )

    customer_result = await db.execute(
        select(Customer).where(Customer.user_id == current_user.id)
    )
    customer = customer_result.scalars().first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer profile not found for this user. Please complete onboarding first."
        )

    if customer.blacklisted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Customer is blacklisted: {customer.blacklisted_reason or 'No reason provided'}"
        )

    if loan_in.principal_amount < product.min_amount or loan_in.principal_amount > product.max_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested amount KES {loan_in.principal_amount:,.2f} is outside the allowed limits of KES {product.min_amount:,.2f} to KES {product.max_amount:,.2f} for this product."
        )

    if loan_in.principal_amount > customer.max_loan_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested amount KES {loan_in.principal_amount:,.2f} exceeds your credit limit of KES {customer.max_loan_limit:,.2f}."
        )

    if loan_in.tenure_months < product.min_tenure_months or loan_in.tenure_months > product.max_tenure_months:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested tenure of {loan_in.tenure_months} months is outside the allowed limits of {product.min_tenure_months} to {product.max_tenure_months} months for this product."
        )

    import random
    app_no = f"LAF-{random.randint(100000000, 999999999)}"

    db_loan = Loan(
        user_id=current_user.id,
        customer_id=customer.id,
        product_id=product.id,
        principal_amount=loan_in.principal_amount,
        amount_requested=loan_in.principal_amount,
        interest_rate=product.interest_rate_monthly,
        tenure_months=loan_in.tenure_months,
        product_type=product.type.value,
        disbursement_method=loan_in.disbursement_method,
        status=LoanStatus.PENDING,
        branch_id=customer.branch_id,
        outstanding_balance=loan_in.principal_amount,
        total_paid=0.0,
        penalty_balance=0.0,
        application_no=app_no
    )
    
    db.add(db_loan)
    await db.commit()
    db_loan = await get_loan_with_relations(db, db_loan.id)
    await log_audit_event(
        db,
        user=current_user.email,
        action="APPLY_LOAN",
        details=f"Applied for loan ID #{db_loan.id} (App No: {db_loan.application_no}) of KES {db_loan.principal_amount}"
    )
    # Invalidate loan caches on mutation
    from app.core.cache import cache_invalidate_pattern
    await cache_invalidate_pattern("loans:*")
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
        
    customer_result = await db.execute(
        select(Customer).where(Customer.user_id == loan_in.borrower_id)
    )
    customer = customer_result.scalars().first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer profile for borrower user ID {loan_in.borrower_id} not found."
        )

    normalized_type = loan_in.loan_type.upper()
    product_result = await db.execute(
        select(LoanProduct).where(LoanProduct.type == normalized_type, LoanProduct.is_active == True)
    )
    product = product_result.scalars().first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Loan product type '{loan_in.loan_type}' is not active or not supported."
        )

    if loan_in.principal_amount < product.min_amount or loan_in.principal_amount > product.max_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Amount KES {loan_in.principal_amount:,.2f} is outside the allowed limits of KES {product.min_amount:,.2f} to KES {product.max_amount:,.2f} for this product."
        )

    if loan_in.term_months < product.min_tenure_months or loan_in.term_months > product.max_tenure_months:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenure of {loan_in.term_months} months is outside the allowed limits of {product.min_tenure_months} to {product.max_tenure_months} months for this product."
        )

    import random
    app_no = f"LAF-{random.randint(100000000, 999999999)}"

    db_loan = Loan(
        user_id=loan_in.borrower_id,
        customer_id=customer.id,
        product_id=product.id,
        principal_amount=loan_in.principal_amount,
        amount_requested=loan_in.principal_amount,
        interest_rate=loan_in.interest_rate,
        tenure_months=loan_in.term_months,
        product_type=product.type.value,
        disbursement_method=loan_in.disbursement_method,
        status=LoanStatus.PENDING,
        branch_id=customer.branch_id,
        outstanding_balance=loan_in.principal_amount,
        total_paid=0.0,
        penalty_balance=0.0,
        application_no=app_no
    )
    
    db.add(db_loan)
    await db.commit()
    db_loan = await get_loan_with_relations(db, db_loan.id)
    await log_audit_event(
        db,
        user=current_user.email,
        action="CREATE_LOAN_ADMIN",
        details=f"Created loan ID #{db_loan.id} (App No: {db_loan.application_no}) for Borrower ID #{loan_in.borrower_id} of KES {db_loan.principal_amount}"
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
        
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Loan)
        .options(selectinload(Loan.product), selectinload(Loan.customer))
        .where(Loan.id == loan_id)
    )
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    if loan.status != LoanStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending loans can be approved")
        
    interest_method = InterestMethod.FLAT
    if loan.product:
        interest_method = loan.product.interest_method

    if interest_method == InterestMethod.REDUCING_BALANCE:
        schedule = loan_engine.calculate_reducing_balance_schedule(
            principal=loan.principal_amount,
            monthly_rate_pct=loan.interest_rate,
            months=loan.tenure_months
        )
    else:
        schedule = loan_engine.calculate_flat_rate_schedule(
            principal=loan.principal_amount,
            monthly_rate_pct=loan.interest_rate,
            months=loan.tenure_months
        )
        
    loan.total_payable = schedule["total_payable"]
    loan.outstanding_balance = schedule["total_payable"]
    
    from app.models.loan import RepaymentSchedule, ScheduleStatus
    from datetime import date
    
    start_date = date.today()
    for line in schedule["schedule_lines"]:
        instalment_due_date = start_date + relativedelta(months=line["installment_no"])
        sched_rec = RepaymentSchedule(
            loan_id=loan.id,
            instalment_no=line["installment_no"],
            due_date=instalment_due_date,
            principal_due=line["principal_due"],
            interest_due=line["interest_due"],
            total_due=line["total_due"],
            amount_paid=0.0,
            status=ScheduleStatus.PENDING
        )
        db.add(sched_rec)
        
    loan.first_due_date = start_date + relativedelta(months=1)
    loan.final_due_date = start_date + relativedelta(months=loan.tenure_months)
    loan.due_date = datetime.now() + relativedelta(months=loan.tenure_months)
    loan.status = LoanStatus.APPROVED
    
    if loan.disbursement_method == DisbursementMethod.LUMP_SUM:
        ref = str(uuid.uuid4())[:8].upper()
        account_target = "0700000000"
        if loan.customer and loan.customer.phone:
            account_target = loan.customer.phone
        elif loan.user and loan.user.phone_number:
            account_target = loan.user.phone_number
            
        disbursement_resp = await kcb_gateway.disburse_loan(
            account_no=account_target,
            amount=loan.principal_amount,
            reference=ref
        )
        
        if disbursement_resp["status"] == "success":
            loan.status = LoanStatus.DISBURSED
            loan.amount_disbursed = loan.principal_amount
            loan.kcb_reference = disbursement_resp["kcb_transaction_id"]
            loan.disbursed_at = datetime.now()
            
            trx = Transaction(
                loan_id=loan.id,
                type=TransactionType.DISBURSEMENT,
                amount=loan.principal_amount,
                reference_code=loan.kcb_reference
            )
            db.add(trx)
            
            fee_trx = Transaction(
                loan_id=loan.id,
                type=TransactionType.PLATFORM_FEE,
                amount=10.0,
                reference_code=f"FEE-{loan.kcb_reference}"
            )
            db.add(fee_trx)
        
    await db.commit()
    loan = await get_loan_with_relations(db, loan.id)
    await log_audit_event(
        db,
        user=current_user.email,
        action="APPROVE_LOAN",
        details=f"Approved loan ID #{loan.id} (Status: {loan.status})"
    )
    # Invalidate loan caches + fire async notification
    from app.core.cache import cache_invalidate_pattern
    await cache_invalidate_pattern("loans:*")
    from app.tasks.notification_tasks import notify_loan_approved
    borrower_name = loan.customer.full_name if loan.customer else "Unknown"
    notify_loan_approved.delay(loan.id, borrower_name)
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
        
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Loan)
        .options(selectinload(Loan.user), selectinload(Loan.customer))
        .where(Loan.id == loan_id)
    )
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
    
    account_target = "0700000000"
    if loan.customer and loan.customer.phone:
        account_target = loan.customer.phone
    elif loan.user and loan.user.phone_number:
        account_target = loan.user.phone_number
        
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
        loan = await get_loan_with_relations(db, loan.id)
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
    loan = await get_loan_with_relations(db, loan.id)
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
    Uses Redis cache-aside pattern (60s TTL) to reduce DB load on the dashboard.
    """
    if current_user.role not in [UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You are not authorized to view global statistics."
        )

    # ── Cache-aside: check Redis first ──────────────────────────────
    from app.core.cache import cache_get, cache_set, CACHE_TTL_SHORT
    CACHE_KEY = "loans:stats:global"
    cached = await cache_get(CACHE_KEY)
    if cached is not None:
        cached["_cached"] = True
        return cached

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

    stats_data = {
        "total_disbursed": total_disbursed,
        "total_expected_revenue": total_expected,
        "total_repaid": total_repaid,
        "total_defaulted_value": total_defaulted_value,
        "total_outstanding_value": (total_expected - total_repaid),
        "total_fees": total_fees,
        "_cached": False,
    }

    # ── Store in cache ──────────────────────────────────────────────
    await cache_set(CACHE_KEY, stats_data, ttl=CACHE_TTL_SHORT)
    return stats_data

@router.get("/me", response_model=list[LoanResponse])
async def get_my_loans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Fetch all loans associated with the current logged-in customer.
    """
    from sqlalchemy.orm import selectinload
    query = select(Loan).options(
        selectinload(Loan.customer),
        selectinload(Loan.product),
        selectinload(Loan.branch),
        selectinload(Loan.repayment_schedules)
    ).where(Loan.user_id == current_user.id).order_by(Loan.created_at.desc())
    result = await db.execute(query)
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
        
    from sqlalchemy.orm import selectinload
    query = select(Loan).options(
        selectinload(Loan.customer),
        selectinload(Loan.product),
        selectinload(Loan.branch),
        selectinload(Loan.repayment_schedules)
    )
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


# Pydantic model for the top-up endpoint (defined before usage)
from pydantic import BaseModel as _PydanticBase

class TopUpApplyPayload(_PydanticBase):
    top_up_amount: float
    additional_tenure_months: int = 0
    reason: str | None = None




@router.post("/{loan_id}/top-up")
async def apply_loan_topup(
    loan_id: int,
    payload: TopUpApplyPayload,

    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Request a top-up on an active/disbursed loan.
    Merges remaining principal with top-up amount, recalculates schedule.

    Eligibility:
    - Loan must be disbursed or active
    - At least 50% of total payable must already be repaid
    - Top-up amount must be positive
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to process loan top-ups."
        )

    from sqlalchemy.orm import selectinload
    from app.models.loan import RepaymentSchedule, ScheduleStatus

    result = await db.execute(
        select(Loan)
        .options(
            selectinload(Loan.product),
            selectinload(Loan.repayment_schedules),
        )
        .where(Loan.id == loan_id)
    )
    loan = result.scalars().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status not in [LoanStatus.DISBURSED, LoanStatus.ACTIVE]:
        raise HTTPException(
            status_code=400,
            detail=f"Loan must be active or disbursed for top-up. Current status: {loan.status.value}"
        )

    # Eligibility: at least 50% of the total payable must be repaid
    if loan.total_payable and loan.total_paid < (loan.total_payable * 0.5):
        pct_paid = (loan.total_paid / loan.total_payable * 100) if loan.total_payable else 0
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient repayment history. {pct_paid:.1f}% repaid — at least 50% required for top-up eligibility."
        )

    if payload.top_up_amount <= 0:
        raise HTTPException(status_code=400, detail="Top-up amount must be greater than zero.")

    # Calculate new merged principal
    remaining_principal = max(0.0, loan.outstanding_balance)
    new_principal = remaining_principal + payload.top_up_amount

    # Determine new tenure
    new_tenure = loan.tenure_months
    if payload.additional_tenure_months > 0:
        new_tenure = loan.tenure_months + payload.additional_tenure_months

    # Recalculate schedule using the product's interest method
    from app.models.loan_product import InterestMethod
    interest_method = InterestMethod.FLAT
    if loan.product:
        interest_method = loan.product.interest_method

    if interest_method == InterestMethod.REDUCING_BALANCE:
        new_schedule = loan_engine.calculate_reducing_balance_schedule(
            principal=new_principal,
            monthly_rate_pct=loan.interest_rate,
            months=new_tenure,
        )
    else:
        new_schedule = loan_engine.calculate_flat_rate_schedule(
            principal=new_principal,
            monthly_rate_pct=loan.interest_rate,
            months=new_tenure,
        )

    # Mark old schedule lines as superseded (soft-clear)
    if loan.repayment_schedules:
        for sched in loan.repayment_schedules:
            if sched.status in [ScheduleStatus.PENDING, ScheduleStatus.PARTIAL]:
                sched.status = ScheduleStatus.PAID  # Mark as closed/superseded
                sched.amount_paid = sched.total_due  # Zero out balance

    # Insert new repayment schedule lines
    from datetime import date
    start_date = date.today()
    for line in new_schedule["schedule_lines"]:
        instalment_due_date = start_date + relativedelta(months=line["installment_no"])
        new_sched = RepaymentSchedule(
            loan_id=loan.id,
            instalment_no=line["installment_no"],
            due_date=instalment_due_date,
            principal_due=line["principal_due"],
            interest_due=line["interest_due"],
            total_due=line["total_due"],
            amount_paid=0.0,
            status=ScheduleStatus.PENDING,
        )
        db.add(new_sched)

    # Update loan financials
    original_outstanding = loan.outstanding_balance
    loan.principal_amount = new_principal
    loan.tenure_months = new_tenure
    loan.total_payable = new_schedule["total_payable"]
    loan.outstanding_balance = new_schedule["total_payable"]
    loan.total_paid = 0.0  # Reset since schedule is recalculated
    loan.first_due_date = start_date + relativedelta(months=1)
    loan.final_due_date = start_date + relativedelta(months=new_tenure)
    loan.due_date = datetime.now() + relativedelta(months=new_tenure)

    # Log the top-up as a transaction
    trx = Transaction(
        loan_id=loan.id,
        type=TransactionType.DISBURSEMENT,
        amount=payload.top_up_amount,
        reference_code=f"TOPUP-{str(uuid.uuid4())[:8].upper()}"
    )
    db.add(trx)

    await db.commit()
    await db.refresh(loan)

    await log_audit_event(
        db,
        user=current_user.email,
        action="LOAN_TOPUP",
        details=f"Top-up of KES {payload.top_up_amount:,.2f} on Loan #{loan.id}. New principal: KES {new_principal:,.2f}, New tenure: {new_tenure}mo"
    )

    return {
        "loan_id": loan.id,
        "original_outstanding": round(original_outstanding, 2),
        "top_up_amount": round(payload.top_up_amount, 2),
        "new_principal": round(new_principal, 2),
        "new_tenure_months": new_tenure,
        "new_total_payable": round(new_schedule["total_payable"], 2),
        "new_monthly_installment": round(new_schedule["monthly_installment"], 2),
        "status": "top_up_applied",
    }


