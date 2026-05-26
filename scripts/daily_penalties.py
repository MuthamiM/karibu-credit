import asyncio
import logging
from datetime import datetime
from sqlalchemy.future import select
from sqlalchemy import text

# Setup environment if running alone
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.loan import Loan, LoanStatus, Transaction, TransactionType
from app.models.penalty_setting import PenaltySetting
from datetime import timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def process_daily_penalties():
    """
    Cron job function to run every night at midnight.
    Scans for loans passing their due_date + grace period that haven't been cleared.
    """
    async with SessionLocal() as db:
        now = datetime.now()
        logger.info(f"Running daily penalties check at {now}")
        
        # Fetch penalty settings
        setting_res = await db.execute(select(PenaltySetting))
        setting = setting_res.scalars().first()
        penalty_rate_pct = setting.penalty_percentage if setting else 10.0
        grace_days = setting.grace_period if setting else 3
        
        logger.info(f"Using settings: Penalty Rate = {penalty_rate_pct}%, Grace Period = {grace_days} days")
        
        # Select active loans
        query = select(Loan).where(
            Loan.status == LoanStatus.DISBURSED
        )
        result = await db.execute(query)
        active_loans = result.scalars().all()
        
        for loan in active_loans:
            if not loan.due_date:
                continue
                
            due_with_grace = loan.due_date + timedelta(days=grace_days)
            if now > due_with_grace:
                outstanding_balance = (loan.total_payable or 0) - loan.total_paid + loan.penalty_balance
                
                if outstanding_balance > 0:
                    logger.info(f"Loan {loan.id} is overdue (Due: {loan.due_date}, Grace Period Ends: {due_with_grace}). Outstanding balance: {outstanding_balance}")
                    
                    # Apply Penalty
                    penalty_amount = outstanding_balance * (penalty_rate_pct / 100)
                    
                    # Update loan state
                    loan.status = LoanStatus.DEFAULTED
                    loan.penalty_balance += penalty_amount
                    
                    # Record transaction
                    trx = Transaction(
                        loan_id=loan.id,
                        type=TransactionType.PENALTY,
                        amount=penalty_amount,
                        reference_code=f"PENALTY-{loan.id}-{now.strftime('%Y%m%d')}"
                    )
                    db.add(trx)
                    
        await db.commit()

        logger.info("Daily penalties check completed successfully.")

if __name__ == "__main__":
    asyncio.run(process_daily_penalties())
