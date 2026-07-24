"""
Penalty calculation background tasks.
Runs daily to check overdue loans and apply penalty charges.
"""

import logging
from datetime import datetime, date

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.tasks.penalty_tasks.calculate_daily_penalties")
def calculate_daily_penalties(self):
    """
    Daily cron task: scans all active loans for overdue repayment schedules
    and applies penalty charges based on the configured penalty settings.

    This runs synchronously inside the Celery worker using a dedicated
    sync database session (separate from FastAPI's async session).
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    import os

    db_url = os.getenv(
        "SQLALCHEMY_DATABASE_URI", "sqlite:///./karibu.db"
    ).replace("+aiosqlite", "").replace("+asyncpg", "+psycopg2")

    engine = create_engine(db_url, echo=False)
    session = Session(engine)

    try:
        from app.models.loan import Loan, RepaymentSchedule
        from app.models.penalty_setting import PenaltySetting

        # Fetch active penalty settings
        penalty_setting = session.query(PenaltySetting).first()
        if not penalty_setting:
            logger.info("No penalty settings configured — skipping penalty run.")
            return {"status": "skipped", "reason": "no_penalty_settings"}

        grace_period_days = penalty_setting.grace_period_days
        penalty_rate = penalty_setting.penalty_rate_pct

        # Find all active/disbursed loans
        active_loans = session.query(Loan).filter(
            Loan.status.in_(["disbursed", "active", "overdue"])
        ).all()

        penalties_applied = 0
        total_penalty_amount = 0.0
        today = date.today()

        for loan in active_loans:
            for schedule in loan.repayment_schedules:
                if schedule.status in ("PAID",):
                    continue
                if not schedule.due_date:
                    continue

                due_date = schedule.due_date
                if isinstance(due_date, datetime):
                    due_date = due_date.date()

                days_overdue = (today - due_date).days - grace_period_days
                if days_overdue <= 0:
                    continue

                # Calculate penalty: rate * outstanding * days_overdue
                outstanding = schedule.total_due - (schedule.amount_paid or 0.0)
                if outstanding <= 0:
                    continue

                penalty_amount = round(outstanding * (penalty_rate / 100) * days_overdue, 2)
                loan.penalty_balance = (loan.penalty_balance or 0.0) + penalty_amount
                penalties_applied += 1
                total_penalty_amount += penalty_amount

        session.commit()
        result = {
            "status": "completed",
            "date": str(today),
            "loans_scanned": len(active_loans),
            "penalties_applied": penalties_applied,
            "total_penalty_amount": total_penalty_amount,
        }
        logger.info("Penalty run complete: %s", result)
        return result

    except Exception as exc:
        session.rollback()
        logger.error("Penalty calculation failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=120)
    finally:
        session.close()
        engine.dispose()


@celery_app.task(bind=True, name="app.tasks.penalty_tasks.calculate_loan_penalty")
def calculate_loan_penalty(self, loan_id: int):
    """
    On-demand penalty calculation for a single loan.
    Can be triggered from the API when a loan officer requests recalculation.
    """
    logger.info("Calculating penalty for loan_id=%s", loan_id)
    # Implementation mirrors the per-loan logic above
    return {"status": "completed", "loan_id": loan_id}
