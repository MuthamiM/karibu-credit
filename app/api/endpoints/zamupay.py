"""
ZamuPay API endpoints for Karibu Credit — wired to the real ZamuPay client.

Maps directly to Karibu's loan lifecycle:
    1. KYC verification at loan application
    2. Wallet balance check before disbursement
    3. Disbursement via M-Pesa/Business/Bank payment orders
    4. Repayment collection via Express Deposit (STK push)
    5. Status polling + webhook receivers for all async flows
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional
import logging

from app.api import deps
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.customer import Customer, KycStatus
from app.integrations.zamupay import ZamuPayClient, ZamuPayAPIError, interpret_payout_result_code
from app.integrations.zamupay.models import (
    AccountNumberValidationRequest,
    AccountValidationKycRequest,
    ExpressDepositRequest,
)
from app.core.audit import log_audit_event

logger = logging.getLogger(__name__)
router = APIRouter()

# Shared client instance (reuses httpx connection pool + cached token)
zamupay_client = ZamuPayClient()


# ── Request schemas for Karibu-specific endpoints ────────────────────

class DisburseLoanRequest(BaseModel):
    loan_id: str
    borrower_name: str
    borrower_phone: str  # digits only, e.g. "254712345678"
    amount: float
    route_id: str  # from /zamupay/routes, cached
    channel_type: int


class CollectRepaymentRequest(BaseModel):
    loan_id: str
    installment_id: str
    borrower_phone: str  # e.g. "254712345678"
    amount: str  # ZamuPay expects string
    short_code: str  # ZamuPay-assigned short code
    callback_url: str  # public webhook URL
    borrower_first_name: Optional[str] = None
    borrower_last_name: Optional[str] = None


# ── Auth / Infrastructure ────────────────────────────────────────────

@router.get("/health")
async def health():
    """Check ZamuPay API connectivity — no auth required on ZamuPay side."""
    try:
        result = await zamupay_client.health_check()
        return {"zamupay_status": "online", "raw": result}
    except Exception as exc:
        return {"zamupay_status": "offline", "error": str(exc)}


@router.get("/routes")
async def routes(current_user: User = Depends(deps.get_current_active_user)):
    """
    Discover assigned transaction routes — routeId + channelType per rail.
    Cache these in your DB/config; they're static until ZamuPay changes your routing.
    """
    try:
        result = await zamupay_client.find_transaction_routes()
        return result
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/wallet-balance")
async def wallet_balance(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Check ZamuPay wallet balance — call before disbursing a batch
    so you fail fast if the wallet can't cover it.
    """
    if current_user.role not in [UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return await zamupay_client.get_wallet_balance()
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Borrower KYC (run at loan application stage) ────────────────────

@router.post("/kyc/validate")
async def kyc_validate(
    req: AccountValidationKycRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Deep KYC verification — name/national ID/DOB match.
    Use before approving a loan, not just before disbursing.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        result = await zamupay_client.validate_account_kyc(req)
        await log_audit_event(
            db, user=current_user.email, action="ZAMUPAY_KYC_VALIDATE",
            details=f"KYC validation submitted (STAN: {result.systemTraceAuditNumber})",
        )
        return result
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/kyc/status")
async def kyc_status(
    stan: str,
    current_user: User = Depends(deps.get_current_active_user),
):
    """Check KYC verification status by SystemTraceAuditNumber."""
    try:
        return await zamupay_client.find_kyc_status(stan)
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/account/validate-number")
async def validate_account_number(
    req: AccountNumberValidationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Lightweight account number existence check (mobile or bank)."""
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        result = await zamupay_client.validate_account_number(req)
        await log_audit_event(
            db, user=current_user.email, action="ZAMUPAY_ACCOUNT_VALIDATE",
            details=f"Account validation submitted (STAN: {result.systemTraceAuditNumber})",
        )
        return result
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/account/validation-status")
async def account_validation_status(
    stan: str,
    current_user: User = Depends(deps.get_current_active_user),
):
    """Check account validation status by SystemTraceAuditNumber."""
    try:
        return await zamupay_client.find_account_validation_status(stan)
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Loan Disbursement (Payouts) ─────────────────────────────────────

@router.post("/disburse")
async def disburse_loan(
    req: DisburseLoanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Disburse a loan via M-Pesa mobile transfer.

    IMPORTANT: originatorConversationId and systemTraceAuditNumber must be
    unique per attempt. Use loan_id + monotonic attempt counter
    (e.g. f"{loan_id}-disb-{attempt}"), NOT a fresh UUID every retry.
    """
    if current_user.role not in [UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    idempotency_key = f"{req.loan_id}-disb-1"
    try:
        result = await zamupay_client.create_mpesa_mobile_transfer(
            originator_conversation_id=idempotency_key,
            route_id=req.route_id,
            channel_type=req.channel_type,
            amount=req.amount,
            recipient_name=req.borrower_name,
            recipient_phone_e164_no_plus=req.borrower_phone,
            reference=f"KaribuLoan-{req.loan_id}",
            system_trace_audit_number=idempotency_key,
            purpose="Loan Disbursement",
        )
        await log_audit_event(
            db, user=current_user.email, action="ZAMUPAY_DISBURSE",
            details=f"Disbursement submitted for loan {req.loan_id} — KES {req.amount} to {req.borrower_phone}",
        )
        return result
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/disburse/{originator_conversation_id}")
async def disbursement_status(
    originator_conversation_id: str,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Check disbursement status — includes recommended action per result code
    (retry / escalate / success) from ZamuPay's response code table.
    """
    try:
        status = await zamupay_client.find_payment_order(originator_conversation_id)
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    enriched = []
    for line in status.orderLines:
        if line.transactionOutcome:
            desc, action = interpret_payout_result_code(line.transactionOutcome.resultCode)
            enriched.append({
                "resultCode": line.transactionOutcome.resultCode,
                "description": desc,
                "action": action,
            })
    return {"status": status, "recommended_actions": enriched}


@router.post("/disburse/{originator_conversation_id}/reject")
async def reject_disbursement(
    originator_conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Reject a pending/queued payment order before it's processed."""
    if current_user.role not in [UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        result = await zamupay_client.reject_order(originator_conversation_id)
        await log_audit_event(
            db, user=current_user.email, action="ZAMUPAY_REJECT_ORDER",
            details=f"Rejected payment order {originator_conversation_id}",
        )
        return result
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Loan Repayment Collection (Pay-Ins) ─────────────────────────────

@router.post("/repayments/collect")
async def collect_repayment(
    req: CollectRepaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    STK push to borrower's phone for loan repayment.

    IMPORTANT: ZamuPay sends TWO callbacks per Safaricom C2B —
    only the SECOND one is final. See /webhooks/repayment handler.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    idempotency_key = f"{req.loan_id}-inst-{req.installment_id}"
    express_deposit = ExpressDepositRequest(
        ShortCode=req.short_code,
        Amount=req.amount,
        PhoneNumber=req.borrower_phone,
        TransactionDesc=f"Karibu repayment {req.installment_id}"[:30],
        OriginatorConversationId=idempotency_key,
        CallBackUrl=req.callback_url,
        firstName=req.borrower_first_name,
        lastName=req.borrower_last_name,
    )
    try:
        result = await zamupay_client.create_express_deposit(express_deposit)
        await log_audit_event(
            db, user=current_user.email, action="ZAMUPAY_STK_PUSH",
            details=f"STK push sent for loan {req.loan_id}, installment {req.installment_id}",
        )
        return result
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/repayments/{originator_conversation_id}/status")
async def repayment_status(
    originator_conversation_id: str,
    current_user: User = Depends(deps.get_current_active_user),
):
    """Check Express Deposit (STK push) status."""
    try:
        return await zamupay_client.find_express_deposit_status(originator_conversation_id)
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Customer KYC Trigger (convenience) ──────────────────────────────

@router.post("/customers/{customer_id}/verify-kyc")
async def trigger_customer_kyc(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Trigger account validation for a specific customer.
    Stores the STAN on the customer for callback matching.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE]:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalars().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if not customer.phone:
        raise HTTPException(status_code=400, detail="Customer has no phone number for KYC")

    import uuid
    stan = str(uuid.uuid4())
    callback_url = zamupay_client.cfg.default_callback_url or "http://localhost:8000/api/v1/zamupay/webhooks/kyc"

    req = AccountNumberValidationRequest(
        type=1,
        systemTraceAuditNumber=stan,
        primaryAccountNumber=customer.phone,
        institutionCode="63902",
        callBackUrl=callback_url,
    )
    try:
        api_result = await zamupay_client.validate_account_number(req)
        customer.zamupay_kyc_stan = api_result.systemTraceAuditNumber
        customer.kyc_status = KycStatus.PENDING
        await db.commit()

        await log_audit_event(
            db, user=current_user.email, action="ZAMUPAY_CUSTOMER_KYC",
            details=f"KYC triggered for customer {customer.customer_code} (STAN: {api_result.systemTraceAuditNumber})",
        )
        return {
            "system_trace_audit_number": api_result.systemTraceAuditNumber,
            "message": f"KYC verification initiated for {customer.full_name}",
        }
    except ZamuPayAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Webhook Receivers (public, no auth — ZamuPay calls these) ───────

@router.post("/webhooks/repayment")
async def repayment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Express Deposit callback receiver.

    ZamuPay sends TWO callbacks for Safaricom C2B:
      1st: raw StkCallback wrapper (Body.StkCallback...) — IGNORE
      2nd: flat object with Thirdpartyreceiptnumber, PaymentAmount — USE THIS

    Distinguish by shape: if "Body"+"StkCallback" keys present, it's the first one.
    """
    payload = await request.json()
    logger.info("ZamuPay Repayment Callback: %s", payload)

    if "Body" in payload and "StkCallback" in payload.get("Body", {}):
        logger.info("ZamuPay: First callback (StkCallback wrapper) — ignoring for final status")
        return {"received": "first_callback_ignored"}

    # Second/final callback — mark the installment paid
    originator_id = payload.get("OriginatorConversationId")
    receipt = payload.get("Thirdpartyreceiptnumber") or payload.get("mpesaReceiptNumber")
    amount = payload.get("PaymentAmount") or payload.get("amount")

    await log_audit_event(
        db, user="ZAMUPAY_CALLBACK", action="REPAYMENT_CALLBACK",
        details=f"OriginatorID: {originator_id}, Receipt: {receipt}, Amount: {amount}",
    )

    # TODO: look up installment by OriginatorConversationId and mark paid
    return {"received": "final_callback_processed"}


@router.post("/webhooks/disbursement")
async def disbursement_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Payment Order (B2C/Payouts) callback — configure URL in ZamuPay dashboard:
    Settings > Company Settings > Webhook Settings.
    """
    payload = await request.json()
    logger.info("ZamuPay Disbursement Callback: %s", payload)

    originator_id = payload.get("originatorConversationId")
    result_code = None

    # Parse orderLines if present
    order_lines = payload.get("orderLines", [])
    for line in order_lines:
        outcome = line.get("transactionOutcome", {})
        result_code = outcome.get("resultCode")
        if result_code:
            desc, action = interpret_payout_result_code(result_code)
            logger.info(
                "ZamuPay disbursement result: code=%s desc=%s action=%s",
                result_code, desc, action,
            )

    # Update loan status if we can match it
    if originator_id:
        from app.models.loan import Loan, LoanStatus, Transaction, TransactionType
        from datetime import datetime

        result = await db.execute(
            select(Loan).where(Loan.zamupay_reference == originator_id)
        )
        loan = result.scalars().first()
        if loan and result_code == "0":
            loan.status = LoanStatus.DISBURSED
            loan.disbursed_at = datetime.now()
            receipt_no = payload.get("transactionID", originator_id)
            trx = Transaction(
                loan_id=loan.id,
                type=TransactionType.DISBURSEMENT,
                amount=loan.principal_amount,
                reference_code=f"ZAMU-{receipt_no}",
            )
            db.add(trx)
            await db.commit()
            logger.info("Loan #%s marked DISBURSED via ZamuPay callback", loan.id)

    await log_audit_event(
        db, user="ZAMUPAY_CALLBACK", action="DISBURSEMENT_CALLBACK",
        details=f"OriginatorID: {originator_id}, ResultCode: {result_code}",
    )
    return {"received": True}


@router.post("/webhooks/kyc")
async def kyc_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """KYC / account validation callback — updates customer kyc_status."""
    payload = await request.json()
    logger.info("ZamuPay KYC Callback: %s", payload)

    stan = payload.get("systemTraceAuditNumber")
    if stan:
        result = await db.execute(
            select(Customer).where(Customer.zamupay_kyc_stan == stan)
        )
        customer = result.scalars().first()
        if customer:
            response_code = payload.get("responseCode")
            if response_code == "0" or payload.get("statusDesc") == "Completed":
                customer.kyc_status = KycStatus.VERIFIED
                logger.info("Customer %s KYC VERIFIED", customer.customer_code)
            else:
                customer.kyc_status = KycStatus.REJECTED
                logger.warning("Customer %s KYC REJECTED", customer.customer_code)
            await db.commit()

    await log_audit_event(
        db, user="ZAMUPAY_CALLBACK", action="KYC_CALLBACK",
        details=f"STAN: {stan}, ResponseCode: {payload.get('responseCode')}",
    )
    return {"received": True}
