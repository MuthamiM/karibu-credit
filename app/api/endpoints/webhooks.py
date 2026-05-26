from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import logging

from app.db.session import get_db
from app.models.loan import Loan, LoanStatus, Transaction, TransactionType, Payment, PaymentSource, PaymentStatus
from app.integrations.mpesa import DarajaGateway
from app.core import loan_engine

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/mpesa/c2b/validation")
async def mpesa_validation(request: Request):
    """
    Safaricom Daraja API Validation URL Endpoint.
    Daraja pings this to check if a Paybill payment is valid before processing it.
    """
    return {"ResultCode": 0, "ResultDesc": "Accepted"}

@router.post("/mpesa/c2b/confirmation")
async def mpesa_confirmation(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Safaricom Daraja API Confirmation URL Endpoint.
    Daraja POSTs the final successful transaction data here. We process it and update the Loan.
    """
    payload = await request.json()
    logger.info(f"Received M-Pesa C2B Confirmation: {payload}")
    
    parsed = DarajaGateway.process_c2b_payment(payload)
    loan_id_str = parsed["account_ref"]
    
    if not loan_id_str or not loan_id_str.isdigit():
        return {"ResultCode": 0, "ResultDesc": "Ignored - Invalid Ref"}
        
    loan_id = int(loan_id_str)
    
    result = await db.execute(
        select(Loan)
        .options(selectinload(Loan.repayment_schedules))
        .where(Loan.id == loan_id)
    )
    loan = result.scalars().first()
    
    if loan:
        # Allocate repayment to schedules, penalties, etc.
        principal_portion, interest_portion, fees_portion = loan_engine.allocate_repayment(loan, parsed["amount"])
        
        # Create detailed Payment record
        payment_record = Payment(
            loan_id=loan.id,
            customer_id=loan.customer_id or 1, # fallback to 1 if not linked
            amount=parsed["amount"],
            principal_portion=principal_portion,
            interest_portion=interest_portion,
            fees_portion=fees_portion,
            mpesa_ref=parsed["receipt"],
            source=PaymentSource.MPESA_C2B,
            status=PaymentStatus.CONFIRMED
        )
        db.add(payment_record)
        
        # Legacy transaction logging
        trx = Transaction(
            loan_id=loan.id,
            type=TransactionType.REPAYMENT,
            amount=parsed["amount"],
            reference_code=parsed["receipt"]
        )
        db.add(trx)
        
        # Platform fee: KES 10 per repayment transaction
        fee_trx = Transaction(
            loan_id=loan.id,
            type=TransactionType.PLATFORM_FEE,
            amount=10.0,
            reference_code=f"FEE-{parsed['receipt']}"
        )
        db.add(fee_trx)
        
        await db.commit()
        
    return {"ResultCode": 0, "ResultDesc": "Success"}
