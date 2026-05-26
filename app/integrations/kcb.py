import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class KCBGateway:
    """
    Integration with KCB B2C / B2B API API Gateway for loan disbursements.
    Sends money from the company account to the client's account directly upon approval.
    """
    def __init__(self):
        # Read from environment variables in production
        self.base_url = "https://api.uat.kcbgroup.com/v1"
        self.client_id = getattr(settings, "KCB_CLIENT_ID", "mock_client_id")
        self.client_secret = getattr(settings, "KCB_CLIENT_SECRET", "mock_client_secret")
        
    async def get_access_token(self) -> str:
        """
        Authenticate against KCB API OAuth endpoints and fetch Bearer tokens.
        """
        # Mocking the OAuth 2.0 Client Credentials flow
        return "mock_kcb_access_token_12345"
        
    async def disburse_loan(self, account_no: str, amount: float, reference: str) -> dict:
        """
        Disburse funds to a client's bank account or mobile wallet via KCB.
        """
        token = await self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "destinationAccount": account_no,
            "amount": amount,
            "currency": "KES",
            "reference": reference,
            "narration": "Karibu Credit Loan Disbursement"
        }
        
        logger.info(f"Initiating KCB Disbursement: {reference} for KES {amount} to account {account_no}")
        
        # Real integration would make the httpx POST call:
        # async with httpx.AsyncClient() as client:
        #     response = await client.post(f"{self.base_url}/disbursements", json=payload, headers=headers)
        #     response.raise_for_status()
        #     return response.json()
        
        # We are returning a simulated successful mock response for testing
        return {
            "status": "success",
            "kcb_transaction_id": f"KCB-{reference}",
            "message": "Funds disbursed successfully"
        }
