from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import logging

from app.db.session import get_db
from app.models.loan import Loan, LoanStatus, Transaction, TransactionType
from app.integrations.mpesa import DarajaGateway

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
    
    result = await db.execute(select(Loan).where(Loan.id == loan_id))
    loan = result.scalars().first()
    
    if loan:
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
        
        # Update loan outstanding balance
        loan.total_paid += parsed["amount"]
        
        target_amount = (loan.total_payable or 0.0) + loan.penalty_balance
        if loan.total_paid >= target_amount:
            loan.status = LoanStatus.CLEARED
        
        await db.commit()
        
    return {"ResultCode": 0, "ResultDesc": "Success"}
