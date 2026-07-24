import asyncio
import logging
from datetime import datetime, timedelta, timezone

# Setup environment if running as a standalone script
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.future import select

from app.db.session import SessionLocal
from app.models.loan import Loan, LoanStatus, Transaction, TransactionType
from app.models.penalty_setting import PenaltySetting

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def process_daily_penalties():
    """
    Cron job function to run every night at midnight (EAT).
    Scans for loans past their due_date + grace period and applies penalties.

    Frequency modes (from PenaltySetting.frequency):
      ONCE   – Penalise each overdue loan only once (skips if any prior PENALTY tx exists).
      DAILY  – Apply penalty on every cron run for all overdue loans with a balance.
      WEEKLY – Apply penalty only if the last PENALTY transaction is ≥ 7 days old.
    """
    async with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        logger.info(f"Running daily penalties check at {now.isoformat()}")

        # ── Fetch global penalty settings ─────────────────────────────────────
        setting_res = await db.execute(select(PenaltySetting))
        setting = setting_res.scalars().first()

        penalty_rate_pct: float = setting.penalty_percentage if setting else 10.0
        grace_days: int = setting.grace_period if setting else 3
        frequency: str = (setting.frequency.value if setting else "ONCE").upper()

        logger.info(
            f"Settings → Penalty Rate: {penalty_rate_pct}%, "
            f"Grace Period: {grace_days} days, Frequency: {frequency}"
        )

        # ── Select candidate loans ────────────────────────────────────────────
        # ONCE mode only needs DISBURSED loans (DEFAULTED ones are already done).
        # DAILY / WEEKLY modes also re-evaluate already-DEFAULTED loans.
        if frequency == "ONCE":
            status_candidates = [LoanStatus.DISBURSED]
        else:
            status_candidates = [LoanStatus.DISBURSED, LoanStatus.DEFAULTED]

        result = await db.execute(
            select(Loan).where(Loan.status.in_(status_candidates))
        )
        loans = result.scalars().all()
        logger.info(f"Evaluating {len(loans)} candidate loan(s)...")

        penalized_count = 0
        skipped_count = 0

        for loan in loans:
            if not loan.due_date:
                skipped_count += 1
                continue

            # ── Normalise due_date to timezone-aware datetime ─────────────────
            due_date = loan.due_date
            if hasattr(due_date, "tzinfo") and due_date.tzinfo is None:
                # Could be a naive datetime or a date object
                if hasattr(due_date, "hour"):
                    due_date = due_date.replace(tzinfo=timezone.utc)
                else:
                    # It's a date, convert to datetime
                    due_date = datetime(due_date.year, due_date.month, due_date.day, tzinfo=timezone.utc)

            due_with_grace = due_date + timedelta(days=grace_days)

            if now <= due_with_grace:
                # Loan is still within its grace window — not overdue yet
                skipped_count += 1
                continue

            # ── Frequency gate ────────────────────────────────────────────────
            last_penalty_tx_res = await db.execute(
                select(Transaction)
                .where(
                    Transaction.loan_id == loan.id,
                    Transaction.type == TransactionType.PENALTY,
                )
                .order_by(Transaction.created_at.desc())
                .limit(1)
            )
            last_penalty_tx = last_penalty_tx_res.scalars().first()

            if frequency == "ONCE" and last_penalty_tx:
                # A penalty was already applied before — skip permanently
                logger.debug(f"Loan {loan.id}: ONCE penalty already applied — skipping.")
                skipped_count += 1
                continue

            if frequency == "WEEKLY" and last_penalty_tx and last_penalty_tx.created_at:
                last_applied = last_penalty_tx.created_at
                if hasattr(last_applied, "tzinfo") and last_applied.tzinfo is None:
                    last_applied = last_applied.replace(tzinfo=timezone.utc)
                days_since = (now - last_applied).days
                if days_since < 7:
                    logger.debug(
                        f"Loan {loan.id}: WEEKLY penalty applied {days_since}d ago — skipping."
                    )
                    skipped_count += 1
                    continue

            # ── Calculate outstanding balance ──────────────────────────────────
            outstanding_balance = round(
                (loan.total_payable or 0.0) - (loan.total_paid or 0.0) + (loan.penalty_balance or 0.0),
                2
            )

            if outstanding_balance <= 0:
                logger.debug(f"Loan {loan.id}: no outstanding balance — skipping.")
                skipped_count += 1
                continue

            # ── Apply penalty ─────────────────────────────────────────────────
            penalty_amount = round(outstanding_balance * (penalty_rate_pct / 100), 2)

            logger.info(
                f"Loan {loan.id} [overdue since {loan.due_date}]: applying {frequency} penalty "
                f"of KES {penalty_amount:,.2f} on outstanding KES {outstanding_balance:,.2f}"
            )

            loan.status = LoanStatus.DEFAULTED
            loan.penalty_balance = round((loan.penalty_balance or 0.0) + penalty_amount, 2)

            # Unique reference per loan per run (appending HHmm avoids DAILY collisions)
            reference_code = f"PENALTY-{loan.id}-{now.strftime('%Y%m%d%H%M')}"
            trx = Transaction(
                loan_id=loan.id,
                type=TransactionType.PENALTY,
                amount=penalty_amount,
                reference_code=reference_code,
            )
            db.add(trx)
            penalized_count += 1

        # ── Commit all changes in a single transaction ────────────────────────
        await db.commit()

        logger.info(
            f"Daily penalties check DONE. "
            f"Penalized: {penalized_count} loan(s) | Skipped: {skipped_count} loan(s)."
        )


if __name__ == "__main__":
    asyncio.run(process_daily_penalties())
