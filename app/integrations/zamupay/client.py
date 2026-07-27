"""
ZamuPay API client for Karibu Credit — built from the actual specs at
docs.zamupay.com (fetched directly), not guessed.

Covers, with real request/response shapes:
    Auth:              Token Request, Find Transaction Routes, Health Check
    Payouts:           Payment Order (Mobile M-Pesa/Airtel, Business, Bank),
                       Find Payment Order, Reject Order
    Account Validation: Account Number Validation, deep KYC Validation,
                       Find KYC Status, Find Account Validation Status
    Pay-Ins:           Express Deposit (STK push collection — loan repayments),
                       Find Express Deposit Status, Payment Links (CRUD)
    Platform:          Balance Check
"""

from __future__ import annotations

import time
from typing import Any, Optional

import httpx

from .config import config
from .exceptions import ZamuPayAPIError
from .models import (
    TokenResponse,
    TransactionRoutesResponse,
    PaymentOrderRequest,
    PaymentOrderLine,
    PaymentOrderTransaction,
    Recipient,
    Remitter,
    PaymentOrderAcceptedResponse,
    PaymentOrderStatusResponse,
    RejectOrderResponse,
    AccountNumberValidationRequest,
    AccountValidationAcceptedResponse,
    AccountValidationKycRequest,
    KycValidationAcceptedResponse,
    KycStatusResponse,
    AccountValidationStatusResponse,
    ExpressDepositRequest,
    ExpressDepositAcceptedResponse,
    ExpressDepositStatusResponse,
    CreatePaymentLinkRequest,
    UpdatePaymentLinkRequest,
    BalanceCheckResponse,
    RawZamuPayResponse,
)


class ZamuPayClient:
    def __init__(self, cfg=config, http_client: Optional[httpx.AsyncClient] = None):
        self.cfg = cfg
        self._client = http_client or httpx.AsyncClient(timeout=30)
        self._token: Optional[str] = None
        self._token_expires_at: float = 0.0

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _url(self, path: str) -> str:
        return f"{self.cfg.base_url}{path}"

    async def _auth_headers(self) -> dict[str, str]:
        token = await self._get_valid_token()
        return {"Authorization": f"Bearer {token}"}

    async def _get_valid_token(self) -> str:
        now = time.time()
        if self._token and now < self._token_expires_at - self.cfg.token_refresh_skew_seconds:
            return self._token
        return await self._refresh_token()

    async def _request(
        self,
        method: str,
        url: str,
        *,
        headers: dict | None = None,
        params: dict | None = None,
        json: dict | None = None,
        data: dict | None = None,
    ) -> dict[str, Any]:
        resp = await self._client.request(
            method, url, headers=headers, params=params, json=json, data=data
        )
        try:
            payload = resp.json()
        except ValueError:
            payload = {"raw_text": resp.text}

        if resp.status_code >= 400:
            raise ZamuPayAPIError(
                f"ZamuPay {method} {url} failed with {resp.status_code}",
                status_code=resp.status_code,
                payload=payload,
            )
        return payload

    async def aclose(self):
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Authorization
    # ------------------------------------------------------------------

    async def _refresh_token(self) -> str:
        """
        POST {base}/connect/token
        Body: x-www-form-urlencoded — client_id, client_secret,
              grant_type=client_credentials, scope
        """
        url = self._url("/connect/token")
        form = {
            "client_id": self.cfg.client_id,
            "client_secret": self.cfg.client_secret,
            "grant_type": "client_credentials",
            "scope": self.cfg.scope,
        }
        data = await self._request("POST", url, data=form)
        token_resp = TokenResponse(**data)
        self._token = token_resp.access_token
        self._token_expires_at = time.time() + token_resp.expires_in
        return self._token

    async def find_transaction_routes(self) -> TransactionRoutesResponse:
        """
        GET {base}/v1/transaction-routes/assigned-routes
        Requires Bearer auth. routeId here is what you plug into every
        Payment Order / KYC Validation request. It's static — cache it
        (DB or env var), don't refetch on every disbursement.
        """
        url = self._url("/v1/transaction-routes/assigned-routes")
        headers = await self._auth_headers()
        data = await self._request("GET", url, headers=headers)
        return TransactionRoutesResponse(**data)

    async def health_check(self) -> str:
        """GET {base}/api_health_check — no auth required."""
        url = self._url("/api_health_check")
        resp = await self._client.get(url)
        return resp.text

    # ------------------------------------------------------------------
    # Payouts — Payment Orders
    # All variants (Mobile M-Pesa/Airtel, Business, Bank) POST to the
    # SAME endpoint: /v1/payment-order/new-order. What differs is the
    # channelType/routeId (from Find Transaction Routes) and which
    # recipient/remitter fields are populated.
    # ------------------------------------------------------------------

    async def create_payment_order(self, order: PaymentOrderRequest) -> PaymentOrderAcceptedResponse:
        """
        POST {base}/v1/payment-order/new-order

        NOTE on duplicates: if originatorConversationId repeats, ZamuPay
        still returns 200/accepted but you'll get a callback with
        transactionOutcome.resultCode "9" (Duplicate transaction) instead
        of a real result — see response_codes.py. Don't treat acceptance
        here as proof of a fresh transaction.
        """
        url = self._url("/v1/payment-order/new-order")
        headers = await self._auth_headers()
        data = await self._request(
            "POST", url, headers=headers, json=order.model_dump(exclude_none=True)
        )
        return PaymentOrderAcceptedResponse(**data)

    async def create_mpesa_mobile_transfer(
        self,
        *,
        originator_conversation_id: str,
        route_id: str,
        channel_type: int,
        amount: float,
        recipient_name: str,
        recipient_phone_e164_no_plus: str,
        reference: str,
        system_trace_audit_number: str,
        purpose: str = "Loan Disbursement",
        recipient_id_number: Optional[str] = None,
        payment_notes: str = "Karibu Credit Disbursement",
    ) -> PaymentOrderAcceptedResponse:
        """
        Convenience wrapper for disbursing a loan directly to a borrower's
        M-Pesa wallet. mccmnc 63902 = Safaricom Kenya.
        """
        order = PaymentOrderRequest(
            originatorConversationId=originator_conversation_id,
            paymentNotes=payment_notes,
            paymentOrderLines=[
                PaymentOrderLine(
                    recipient=Recipient(
                        name=recipient_name,
                        phoneNumber=f"+{recipient_phone_e164_no_plus}",
                        primaryAccountNumber=f"+{recipient_phone_e164_no_plus}",
                        idNumber=recipient_id_number,
                        mccmnc="63902",
                        ccy=404,
                        country="KE",
                        purpose=purpose,
                    ),
                    transaction=PaymentOrderTransaction(
                        routeId=route_id,
                        channelType=channel_type,
                        amount=amount,
                        reference=reference,
                        systemTraceAuditNumber=system_trace_audit_number,
                    ),
                )
            ],
        )
        return await self.create_payment_order(order)

    async def create_business_transfer(
        self,
        *,
        originator_conversation_id: str,
        route_id: str,
        channel_type: int,
        amount: float,
        recipient_name: str,
        institution_identifier: str,
        account_number: str,
        financial_institution: str,
        reference: str,
        system_trace_audit_number: str,
        purpose: str = "Loan Disbursement",
        payment_notes: str = "Karibu Credit Business Transfer",
    ) -> PaymentOrderAcceptedResponse:
        """Business Transfer — M-Pesa Paybill or Till (Buy Goods) disbursement."""
        order = PaymentOrderRequest(
            originatorConversationId=originator_conversation_id,
            paymentNotes=payment_notes,
            paymentOrderLines=[
                PaymentOrderLine(
                    recipient=Recipient(
                        name=recipient_name,
                        financialInstitution=financial_institution,
                        primaryAccountNumber=account_number,
                        mccmnc="63902",
                        ccy=404,
                        country="KE",
                        purpose=purpose,
                        institutionIdentifier=institution_identifier,
                    ),
                    transaction=PaymentOrderTransaction(
                        routeId=route_id,
                        channelType=channel_type,
                        amount=amount,
                        reference=reference,
                        systemTraceAuditNumber=system_trace_audit_number,
                        accountNo=account_number,
                    ),
                )
            ],
        )
        return await self.create_payment_order(order)

    async def create_bank_transfer(
        self,
        *,
        originator_conversation_id: str,
        route_id: str,
        channel_type: int,
        amount: float,
        remitter: Remitter,
        recipient_name: str,
        recipient_phone: str,
        bank_name: str,
        bank_code: str,
        bank_account_number: str,
        mccmnc: str,
        reference: str,
        system_trace_audit_number: str,
        purpose: str = "Savings",
        payment_notes: str = "Karibu Credit Bank Transfer",
    ) -> PaymentOrderAcceptedResponse:
        """
        Bank Transfer. Remitter fields are MANDATORY here (unlike mobile
        transfers where remitter is often omitted).
        """
        order = PaymentOrderRequest(
            originatorConversationId=originator_conversation_id,
            paymentNotes=payment_notes,
            paymentOrderLines=[
                PaymentOrderLine(
                    remitter=remitter,
                    recipient=Recipient(
                        name=recipient_name,
                        phoneNumber=recipient_phone,
                        financialInstitution=bank_name,
                        institutionIdentifier=bank_code,
                        primaryAccountNumber=bank_account_number,
                        mccmnc=mccmnc,
                        ccy=404,
                        country="KE",
                        purpose=purpose,
                    ),
                    transaction=PaymentOrderTransaction(
                        routeId=route_id,
                        channelType=channel_type,
                        amount=amount,
                        reference=reference,
                        systemTraceAuditNumber=system_trace_audit_number,
                    ),
                )
            ],
        )
        return await self.create_payment_order(order)

    async def find_payment_order(self, originator_conversation_id: str) -> PaymentOrderStatusResponse:
        """GET {base}/v1/payment-order/check-status?Id=...&IdType=OriginatorConversationId"""
        url = self._url("/v1/payment-order/check-status")
        headers = await self._auth_headers()
        params = {"Id": originator_conversation_id, "IdType": "OriginatorConversationId"}
        data = await self._request("GET", url, headers=headers, params=params)
        return PaymentOrderStatusResponse(**data)

    async def reject_order(self, originator_conversation_id: str) -> RejectOrderResponse:
        """
        POST {base}/v1/payment-order/reject-order?OriginatorConversationId=...
        Only works while the transaction is Pending or Queued.
        """
        url = self._url("/v1/payment-order/reject-order")
        headers = await self._auth_headers()
        params = {"OriginatorConversationId": originator_conversation_id}
        data = await self._request("POST", url, headers=headers, params=params)
        return RejectOrderResponse(**data)

    # ------------------------------------------------------------------
    # Account Validation
    # ------------------------------------------------------------------

    async def validate_account_number(
        self, req: AccountNumberValidationRequest
    ) -> AccountValidationAcceptedResponse:
        """
        POST {base}/v1/account/validate
        Lightweight check: does this mobile/bank account number exist?
        """
        url = self._url("/v1/account/validate")
        headers = await self._auth_headers()
        data = await self._request(
            "POST", url, headers=headers, json=req.model_dump(exclude_none=True)
        )
        return AccountValidationAcceptedResponse(**data)

    async def validate_account_kyc(
        self, req: AccountValidationKycRequest
    ) -> KycValidationAcceptedResponse:
        """
        POST {base}/v1/kyc-request/validate
        Deep identity verification — use for borrower KYC before approving a loan.
        """
        url = self._url("/v1/kyc-request/validate")
        headers = await self._auth_headers()
        data = await self._request(
            "POST", url, headers=headers, json=req.model_dump(exclude_none=True)
        )
        return KycValidationAcceptedResponse(**data)

    async def find_kyc_status(self, stan: str) -> KycStatusResponse:
        """GET {base}/v1/kyc-request/check-status?stan=<SystemTraceAuditNumber>"""
        url = self._url("/v1/kyc-request/check-status")
        headers = await self._auth_headers()
        data = await self._request("GET", url, headers=headers, params={"stan": stan})
        return KycStatusResponse(**data)

    async def find_account_validation_status(self, stan: str) -> AccountValidationStatusResponse:
        """GET {base}/v1/account/query?stan=<SystemTraceAuditNumber>"""
        url = self._url("/v1/account/query")
        headers = await self._auth_headers()
        data = await self._request("GET", url, headers=headers, params={"stan": stan})
        return AccountValidationStatusResponse(**data)

    # ------------------------------------------------------------------
    # Pay-Ins — Express Deposits (STK push) — loan repayment collection
    # ------------------------------------------------------------------

    async def create_express_deposit(self, req: ExpressDepositRequest) -> ExpressDepositAcceptedResponse:
        """
        POST {base}/v1/express-deposit
        STK-push style collection — prompt a borrower's phone for repayment.

        IMPORTANT: ZamuPay sends TWO callbacks for Safaricom C2B.
        Only the SECOND one is the final status.
        """
        url = self._url("/v1/express-deposit")
        headers = await self._auth_headers()
        data = await self._request(
            "POST", url, headers=headers, json=req.model_dump(exclude_none=True)
        )
        return ExpressDepositAcceptedResponse(**data)

    async def find_express_deposit_status(
        self, originator_conversation_id: str
    ) -> ExpressDepositStatusResponse:
        """GET {base}/v1/express-deposit/check-status?OriginatorConversationId=..."""
        url = self._url("/v1/express-deposit/check-status")
        headers = await self._auth_headers()
        params = {"OriginatorConversationId": originator_conversation_id}
        data = await self._request("GET", url, headers=headers, params=params)
        return ExpressDepositStatusResponse(**data)

    # ------------------------------------------------------------------
    # Pay-Ins — Payment Links
    # ------------------------------------------------------------------

    async def create_payment_link(self, req: CreatePaymentLinkRequest) -> RawZamuPayResponse:
        """POST {base}/v1/payment-link/create-payment-link"""
        url = self._url("/v1/payment-link/create-payment-link")
        headers = await self._auth_headers()
        data = await self._request(
            "POST", url, headers=headers, json=req.model_dump(exclude_none=True)
        )
        return RawZamuPayResponse(raw=data)

    async def find_payment_link(self, link_id: str) -> RawZamuPayResponse:
        """GET {base}/v1/payment-link/get-payment-link?Id=..."""
        url = self._url("/v1/payment-link/get-payment-link")
        headers = await self._auth_headers()
        data = await self._request("GET", url, headers=headers, params={"Id": link_id})
        return RawZamuPayResponse(raw=data)

    async def update_payment_link(self, req: UpdatePaymentLinkRequest) -> RawZamuPayResponse:
        """PUT {base}/v1/payment-link/update-payment-link"""
        url = self._url("/v1/payment-link/update-payment-link")
        headers = await self._auth_headers()
        data = await self._request(
            "PUT", url, headers=headers, json=req.model_dump(exclude_none=True)
        )
        return RawZamuPayResponse(raw=data)

    # ------------------------------------------------------------------
    # Platform Services — Balance Check
    # ------------------------------------------------------------------

    async def get_wallet_balance(self, ccy: str = "404") -> BalanceCheckResponse:
        """
        GET {base}/v1/customer-accounts/get-wallet-balance?ccy=404
        404 = KES. Check before disbursing a batch to fail fast.
        """
        url = self._url("/v1/customer-accounts/get-wallet-balance")
        headers = await self._auth_headers()
        data = await self._request("GET", url, headers=headers, params={"ccy": ccy})
        return BalanceCheckResponse(**data)
