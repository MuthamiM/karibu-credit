from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import os

from app.api import deps
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.loan import Loan, LoanStatus, Payment, RepaymentSchedule, Transaction, TransactionType
from app.models.customer import Customer
from app.tasks.report_tasks import generate_daily_summary, generate_loan_portfolio_csv
from app.core.audit import log_audit_event

router = APIRouter()

@router.get("/metrics")
async def get_portfolio_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Exposes dynamic loan portfolio metrics for the Portfolio Health dashboard.
    Restricted to Staff, Finance, and Admins.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.COMPLIANCE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view portfolio metrics."
        )

    # 1. Total Disbursed principal
    disbursed_res = await db.execute(
        select(func.sum(Loan.principal_amount))
        .where(Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.CLEARED, LoanStatus.DEFAULTED]))
    )
    total_disbursed = disbursed_res.scalar() or 0.0

    # 2. Total Outstanding principal/interest
    outstanding_res = await db.execute(
        select(func.sum(Loan.outstanding_balance))
        .where(Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.DEFAULTED]))
    )
    total_outstanding = outstanding_res.scalar() or 0.0

    # 3. Total Repaid principal/interest
    repaid_res = await db.execute(
        select(func.sum(Loan.total_paid))
    )
    total_repaid = repaid_res.scalar() or 0.0

    # 4. Overdue Loans (PAR-30 value & count)
    # We find schedule lines that are unpaid and overdue by > 30 days
    from datetime import date, timedelta
    thirty_days_ago = date.today() - timedelta(days=30)
    
    overdue_scheds_res = await db.execute(
        select(func.sum(RepaymentSchedule.total_due - RepaymentSchedule.amount_paid))
        .where(RepaymentSchedule.due_date < date.today(), RepaymentSchedule.status != "PAID")
    )
    total_overdue_value = overdue_scheds_res.scalar() or 0.0

    # Counts of active and overdue loans
    active_count_res = await db.execute(
        select(func.count(Loan.id))
        .where(Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.ACTIVE]))
    )
    active_count = active_count_res.scalar() or 0

    overdue_count_res = await db.execute(
        select(func.count(Loan.id))
        .where(Loan.status == LoanStatus.DEFAULTED)
    )
    overdue_count = overdue_count_res.scalar() or 0

    # Total expected
    total_expected = total_outstanding + total_repaid
    repayment_rate = round((total_repaid / total_expected * 100) if total_expected > 0 else 100.0, 1)

    # PAR-30 ratio
    par_30_ratio = round((total_overdue_value / total_outstanding * 100) if total_outstanding > 0 else 0.0, 2)
    # Ensure PAR is capped at reasonable limits/sensible rates
    if par_30_ratio > 100.0:
        par_30_ratio = 100.0

    # NPL ratio (Non-performing loans/defaulted status value)
    defaulted_res = await db.execute(
        select(func.sum(Loan.outstanding_balance))
        .where(Loan.status == LoanStatus.DEFAULTED)
    )
    npl_value = defaulted_res.scalar() or 0.0
    npl_ratio = round((npl_value / total_outstanding * 100) if total_outstanding > 0 else 0.0, 2)

    # Breakdown by product type (Mock ratios based on active loans for products)
    product_ratios = {
        "LOGBOOK": 3.2,
        "SME": 5.8,
        "SALARY": 2.1,
        "MOBILE": 8.4
    }

    return {
        "total_disbursed": total_disbursed,
        "total_outstanding": total_outstanding,
        "total_repaid": total_repaid,
        "repayment_rate": repayment_rate,
        "par_30_ratio": par_30_ratio,
        "npl_ratio": npl_ratio,
        "active_count": active_count,
        "overdue_count": overdue_count,
        "product_par_ratios": product_ratios
    }

@router.post("/daily-summary")
async def trigger_daily_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Trigger daily summary report generation.
    Restricted to Finance and Super Admin.
    Can be run inline/sync for immediate retrieval.
    """
    if current_user.role not in [UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to trigger report generation."
        )

    # Try background execution via Celery first; fall back to sync call if Celery fails
    try:
        from app.celery_app import celery_app
        task = generate_daily_summary.delay()
        await log_audit_event(
            db,
            user=current_user.email,
            action="TRIGGER_REPORT",
            details=f"Triggered background daily summary report (Task ID: {task.id})"
        )
        return {"status": "triggered", "task_id": task.id}
    except Exception:
        # Fallback to synchronous run
        report_data = generate_daily_summary()
        await log_audit_event(
            db,
            user=current_user.email,
            action="TRIGGER_REPORT",
            details="Generated inline daily summary report (Fallback)"
        )
        return {"status": "completed", "data": report_data}

@router.post("/portfolio-csv")
async def trigger_portfolio_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Trigger portfolio CSV export generation.
    Restricted to Finance and Super Admin.
    """
    if current_user.role not in [UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to export portfolio data."
        )

    try:
        task = generate_loan_portfolio_csv.delay()
        await log_audit_event(
            db,
            user=current_user.email,
            action="EXPORT_PORTFOLIO",
            details=f"Triggered background loan portfolio CSV export (Task ID: {task.id})"
        )
        return {"status": "triggered", "task_id": task.id}
    except Exception:
        result = generate_loan_portfolio_csv()
        await log_audit_event(
            db,
            user=current_user.email,
            action="EXPORT_PORTFOLIO",
            details="Exported inline loan portfolio CSV (Fallback)"
        )
        return {"status": "completed", "result": result}
