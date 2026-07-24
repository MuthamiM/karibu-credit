"""
Notification background tasks.
Handles payment reminders, loan approval alerts, and disbursement notifications.
"""

import logging
from datetime import date, timedelta

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.tasks.notification_tasks.send_payment_reminders")
def send_payment_reminders(self):
    """
    Daily task: checks for repayment schedules due in the next 3 days
    and sends reminder notifications to borrowers.
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
        from app.models.loan import RepaymentSchedule

        today = date.today()
        reminder_window = today + timedelta(days=3)

        upcoming = session.query(RepaymentSchedule).filter(
            RepaymentSchedule.due_date.between(today, reminder_window),
            RepaymentSchedule.status.notin_(["PAID"]),
        ).all()

        reminders_sent = 0
        for schedule in upcoming:
            # In production, this would integrate with an SMS/email gateway
            # e.g. Africa's Talking SMS API or SendGrid
            logger.info(
                "📱 REMINDER: Loan %s — installment #%s of KES %.2f due on %s",
                schedule.loan_id,
                schedule.instalment_no,
                schedule.total_due,
                schedule.due_date,
            )
            reminders_sent += 1

        result = {
            "status": "completed",
            "date": str(today),
            "reminders_sent": reminders_sent,
        }
        logger.info("Payment reminders complete: %s", result)
        return result

    except Exception as exc:
        logger.error("Payment reminders failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=120)
    finally:
        session.close()
        engine.dispose()


@celery_app.task(name="app.tasks.notification_tasks.notify_loan_approved")
def notify_loan_approved(loan_id: int, borrower_name: str):
    """
    Triggered when a loan is approved. Sends an approval notification.
    """
    logger.info(
        " NOTIFICATION: Loan #%s approved for %s",
        loan_id, borrower_name,
    )
    return {"status": "sent", "loan_id": loan_id, "type": "approval"}


@celery_app.task(name="app.tasks.notification_tasks.notify_loan_disbursed")
def notify_loan_disbursed(loan_id: int, amount: float, borrower_name: str):
    """
    Triggered when a loan is disbursed. Sends a disbursement confirmation.
    """
    logger.info(
        " NOTIFICATION: KES %.2f disbursed for Loan #%s to %s",
        amount, loan_id, borrower_name,
    )
    return {"status": "sent", "loan_id": loan_id, "type": "disbursement", "amount": amount}
