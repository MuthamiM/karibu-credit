import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class DarajaGateway:
    """
    Safaricom Daraja API for Loan Repayments (C2B Paybill).
    """
    
    @staticmethod
    def process_c2b_payment(payload: dict) -> dict:
        """
        Parses an incoming webhook from Daraja when a customer pays via Paybill.
        """
        amount = payload.get("TransAmount")
        receipt = payload.get("TransID")
        account_no = payload.get("BillRefNumber") # Customer uses Loan ID or ID Number as account
        phone = payload.get("MSISDN")
        
        return {
            "receipt": receipt,
            "amount": float(amount) if amount else 0.0,
            "account_ref": account_no,
            "phone": phone
        }
