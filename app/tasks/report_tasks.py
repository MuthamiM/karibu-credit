"""
Report generation background tasks.
Handles async creation of PDF/CSV reports for loan portfolios, 
daily summaries, and custom exports.
"""

import logging
import json
import os
from datetime import date, datetime

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "reports")


@celery_app.task(bind=True, name="app.tasks.report_tasks.generate_daily_summary")
def generate_daily_summary(self):
    """
    Daily task: generates a summary report of the day's loan activity.
    Saves a JSON report to the reports/ directory.
    """
    from sqlalchemy import create_engine, func
    from sqlalchemy.orm import Session

    db_url = os.getenv(
        "SQLALCHEMY_DATABASE_URI", "sqlite:///./karibu.db"
    ).replace("+aiosqlite", "").replace("+asyncpg", "+psycopg2")

    engine = create_engine(db_url, echo=False)
    session = Session(engine)

    try:
        from app.models.loan import Loan, Payment
        from app.models.customer import Customer

        today = date.today()

        # Gather summary metrics
        total_loans = session.query(func.count(Loan.id)).scalar() or 0
        active_loans = session.query(func.count(Loan.id)).filter(
            Loan.status.in_(["disbursed", "active"])
        ).scalar() or 0
        overdue_loans = session.query(func.count(Loan.id)).filter(
            Loan.status == "overdue"
        ).scalar() or 0
        total_borrowers = session.query(func.count(Customer.id)).scalar() or 0

        total_disbursed = session.query(
            func.coalesce(func.sum(Loan.principal_amount), 0)
        ).filter(Loan.status.in_(["disbursed", "active", "cleared"])).scalar()

        total_outstanding = session.query(
            func.coalesce(func.sum(Loan.outstanding_balance), 0)
        ).filter(Loan.status.in_(["disbursed", "active", "overdue"])).scalar()

        report = {
            "report_type": "daily_summary",
            "generated_at": datetime.now().isoformat(),
            "date": str(today),
            "metrics": {
                "total_loans": total_loans,
                "active_loans": active_loans,
                "overdue_loans": overdue_loans,
                "total_borrowers": total_borrowers,
                "total_disbursed": float(total_disbursed),
                "total_outstanding": float(total_outstanding),
                "portfolio_at_risk": round(
                    (overdue_loans / active_loans * 100) if active_loans > 0 else 0, 2
                ),
            },
        }

        # Save report to file
        os.makedirs(REPORTS_DIR, exist_ok=True)
        report_path = os.path.join(REPORTS_DIR, f"daily_summary_{today}.json")
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)

        logger.info("📊 Daily summary report generated: %s", report_path)
        return report

    except Exception as exc:
        logger.error("Report generation failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=120)
    finally:
        session.close()
        engine.dispose()


@celery_app.task(bind=True, name="app.tasks.report_tasks.generate_loan_portfolio_csv")
def generate_loan_portfolio_csv(self, filters: dict = None):
    """
    On-demand task: generates a CSV export of the full loan portfolio.
    Triggered by admin users from the dashboard.
    """
    import csv

    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    db_url = os.getenv(
        "SQLALCHEMY_DATABASE_URI", "sqlite:///./karibu.db"
    ).replace("+aiosqlite", "").replace("+asyncpg", "+psycopg2")

    engine = create_engine(db_url, echo=False)
    session = Session(engine)

    try:
        from app.models.loan import Loan

        query = session.query(Loan)
        if filters and filters.get("status"):
            query = query.filter(Loan.status == filters["status"])

        loans = query.all()
        today = date.today()

        os.makedirs(REPORTS_DIR, exist_ok=True)
        csv_path = os.path.join(REPORTS_DIR, f"loan_portfolio_{today}.csv")

        with open(csv_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Loan ID", "Customer ID", "Principal Amount", "Status",
                "Outstanding Balance", "Total Paid", "Created At",
            ])
            for loan in loans:
                writer.writerow([
                    loan.id, loan.customer_id, loan.principal_amount, loan.status,
                    loan.outstanding_balance, loan.total_paid, loan.created_at,
                ])

        result = {
            "status": "completed",
            "file": csv_path,
            "total_records": len(loans),
            "generated_at": datetime.now().isoformat(),
        }
        logger.info("📄 Loan portfolio CSV generated: %s", result)
        return result

    except Exception as exc:
        logger.error("CSV report generation failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=120)
    finally:
        session.close()
        engine.dispose()
