"""
Pydantic models built directly from confirmed ZamuPay docs
(docs.zamupay.com). Every field name/type here traces to an actual
documented sample payload — nothing invented.
"""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Auth — POST /connect/token
# ---------------------------------------------------------------------------

class TokenResponse(BaseModel):
    access_token: str
    expires_in: int
    token_type: str
    scope: str


# ---------------------------------------------------------------------------
# Find Transaction Routes — GET /v1/transaction-routes/assigned-routes
# ---------------------------------------------------------------------------

class ChannelType(BaseModel):
    channelType: int
    channelDescription: str


class TransactionRoute(BaseModel):
    id: str  # this is the routeId used in payment order / KYC requests
    category: str
    categoryDescription: str
    categoryIsEnabled: bool
    routeIntergration: str  # sic — typo preserved from ZamuPay's actual API
    country: str
    routeIsActive: bool
    channelTypes: list[ChannelType] = Field(default_factory=list)


class TransactionRoutesResponse(BaseModel):
    routes: list[TransactionRoute] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Payment Order Request (Payouts) — POST /v1/payment-order/new-order
# Shared by: Mobile (M-Pesa/Airtel), Business Transfers, Bank Transfers
# ---------------------------------------------------------------------------

class Remitter(BaseModel):
    """Only required for Payment Remittance Company use cases / Bank Transfers."""
    name: Optional[str] = None
    address: Optional[str] = None
    phoneNumber: Optional[str] = None
    idType: Optional[str] = None
    idNumber: Optional[str] = None
    idIssueDate: Optional[str] = None
    idIssuePlace: Optional[str] = None
    idExpiryDate: Optional[str] = None
    country: Optional[str] = None
    nationality: Optional[str] = None
    ccy: Optional[int] = None
    financialInstitution: Optional[str] = None
    sourceOfFunds: Optional[str] = None
    principalActivity: Optional[str] = None
    dateOfBirth: Optional[str] = None
    occupation: Optional[str] = None
    emailAddress: Optional[str] = None


class Recipient(BaseModel):
    name: str
    address: Optional[str] = None
    emailAddress: Optional[str] = None
    phoneNumber: Optional[str] = None
    idType: Optional[str] = None
    idNumber: Optional[str] = None
    mccmnc: Optional[str] = None  # mandatory for mobile payment order requests
    financialInstitution: Optional[str] = None
    institutionIdentifier: Optional[str] = None
    primaryAccountNumber: str  # account/phone number being credited
    ccy: int
    country: Optional[str] = None
    purpose: str
    nationality: Optional[str] = None


class PaymentOrderTransaction(BaseModel):
    routeId: str  # from Find Transaction Routes
    channelType: int
    amount: float
    reference: str
    systemTraceAuditNumber: str
    customerAccountNo: Optional[str] = None
    accountNo: Optional[str] = None


class PaymentOrderLine(BaseModel):
    remitter: Optional[Remitter] = None
    recipient: Recipient
    transaction: PaymentOrderTransaction


class PaymentOrderRequest(BaseModel):
    originatorConversationId: str
    paymentNotes: str
    paymentOrderLines: list[PaymentOrderLine]


class PaymentOrderAcceptedMessage(BaseModel):
    appDomainName: str
    systemConversationId: str
    originatorConversationId: str
    remarks: str
    timestamp: str


class PaymentOrderAcceptedResponse(BaseModel):
    message: PaymentOrderAcceptedMessage


class PaymentOrderErrorItem(BaseModel):
    field: str
    message: str


class PaymentOrderErrorResponse(BaseModel):
    appDomainName: str
    status: Any
    timestamp: str
    systemConversationId: str
    originatorConversationId: str
    errors: list[PaymentOrderErrorItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Find Payment Order By OriginatorConversationId
# GET /v1/payment-order/check-status
# ---------------------------------------------------------------------------

class TransactionOutcomeThirdParty(BaseModel):
    thirdPartyResponseCode: Optional[str] = None
    thirdPartyResponseCodeDescription: Optional[str] = None
    thirdPartyResultCode: Optional[str] = None
    thirdPartyResultCodeDescription: Optional[str] = None
    thirdPartyReceiptNumber: Optional[str] = None


class TransactionOutcome(BaseModel):
    id: str
    paymentAmount: float
    feeAmount: float
    trackingNumber: Optional[str] = None
    transactionStatus: int
    transactionStatusDescription: str
    workingAccountAvailableFunds: Optional[float] = None
    utilityAccountAvailableFunds: Optional[float] = None
    walletBalance: Optional[float] = None
    transactionDate: Optional[str] = None
    transactionCreditParty: Optional[str] = None
    resultCode: str
    resultCodeDescription: str
    thirdPartyPayload: Optional[TransactionOutcomeThirdParty] = None


class PaymentOrderStatusLine(BaseModel):
    remitter: Optional[dict[str, Any]] = None
    recipient: Optional[dict[str, Any]] = None
    transaction: Optional[dict[str, Any]] = None
    transactionOutcome: Optional[TransactionOutcome] = None


class PaymentOrderStatusResponse(BaseModel):
    id: str
    conversationId: Optional[str] = None
    originatorConversationId: str
    remarks: Optional[str] = None
    isProcessed: bool
    orderLines: list[PaymentOrderStatusLine] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Reject Order — POST /v1/payment-order/reject-order
# ---------------------------------------------------------------------------

class RejectOrderLine(BaseModel):
    originatorConversationId: str
    transactionStatus: int
    transactionStatusDescription: str
    resultCode: str
    resultCodeDescription: str


class RejectOrderResponse(BaseModel):
    paymentOrderlines: list[RejectOrderLine] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Account Number Validation Request — POST /v1/account/validate
# ---------------------------------------------------------------------------

class AccountNumberValidationRequest(BaseModel):
    type: int  # 1 = mobile, 2 = bank
    systemTraceAuditNumber: str
    primaryAccountNumber: str
    institutionCode: str
    callBackUrl: str
    callBackFormat: str = "JSON"
    ccy: Optional[str] = None
    countryCode: Optional[str] = None


class AccountValidationAcceptedResponse(BaseModel):
    systemTraceAuditNumber: str
    message: str


class AccountValidationCallback(BaseModel):
    validationType: int
    validationTypeDesc: str
    accountNumber: str
    accountNumberCCY: str
    institutionCode: str
    countryCode: str
    callbackURL: Optional[str] = None
    status: int
    statusDesc: str
    systemTraceAuditNumber: str
    conversationID: Optional[str] = None
    responseCode: Optional[str] = None
    responseDesc: Optional[str] = None
    resultCode: Optional[str] = None
    resultDesc: Optional[str] = None
    transactionID: Optional[str] = None
    transactionCreditParty: Optional[str] = None
    createdDate: Optional[str] = None


# ---------------------------------------------------------------------------
# Account Validation (deep KYC) — POST /v1/kyc-request/validate
# ---------------------------------------------------------------------------

class AccountValidationKycRequest(BaseModel):
    routeId: str
    kycRequestFirstName: str
    kycRequestMiddleName: Optional[str] = None
    kycRequestLastName: Optional[str] = None
    kycRequestOtherNames: Optional[str] = None
    kycRequestNationalID: str
    serialNo: Optional[str] = None
    kycRequestPassportNo: Optional[str] = None
    kycRequestServiceID: Optional[str] = None
    kycRequestAlienID: Optional[str] = None
    kycRequestTaxID: Optional[str] = None
    kycRequestDateOfBirth: Optional[str] = None
    kycRequestPostalBoxNo: Optional[str] = None
    kycRequestPostalTown: Optional[str] = None
    kycRequestTelephoneMobile: Optional[str] = None
    kycRequestPhysicalAddress: Optional[str] = None
    kycRequestPhysicalTown: Optional[str] = None
    kycRequestPhysicalCountry: Optional[str] = None
    kycRequestReportReason: int
    kycRequestCallBackURL: Optional[str] = None
    deviceId: Optional[str] = None
    systemTraceAuditNumber: str
    country: str
    ccy: int


class KycValidationAcceptedResponse(BaseModel):
    systemTraceAuditNumber: str
    message: str


# ---------------------------------------------------------------------------
# Find KYC Status by SystemTraceAuditNumber
# GET /v1/kyc-request/check-status
# ---------------------------------------------------------------------------

class KycRecordDto(BaseModel):
    status: Optional[int] = None
    responseCode: Optional[str] = None
    responseCodeDesc: Optional[str] = None
    kycRequestFirstName: Optional[str] = None
    kycRequestMiddleName: Optional[str] = None
    kycRequestLastName: Optional[str] = None
    kycRequestOtherNames: Optional[str] = None
    kycRequestFullNames: Optional[str] = None
    kycRequestNationalID: Optional[str] = None
    kycRequestTelephoneMobile: Optional[str] = None
    kycRequestReportReason: Optional[int] = None
    kycRequestCallBackURL: Optional[str] = None
    personalProfileNationalID: Optional[str] = None


class KycStatusResponse(BaseModel):
    status: str
    statusDesc: str
    kycRecordDto: Optional[KycRecordDto] = None


# ---------------------------------------------------------------------------
# Find Account Validation Status — GET /v1/account/query
# ---------------------------------------------------------------------------

class AccountValidationStatusResponse(BaseModel):
    validationType: int
    validationTypeDesc: str
    accountNumber: str
    accountNumberCCY: str
    institutionCode: str
    countryCode: str
    callbackURL: Optional[str] = None
    status: int
    statusDesc: str
    systemTraceAuditNumber: str
    conversationID: Optional[str] = None
    responseCode: Optional[str] = None
    responseDesc: Optional[str] = None
    resultCode: Optional[str] = None
    resultDesc: Optional[str] = None
    transactionID: Optional[str] = None
    transactionCreditParty: Optional[str] = None
    createdDate: Optional[str] = None


# ---------------------------------------------------------------------------
# Express Deposit Request (C2B — loan repayments) — POST /v1/express-deposit
# ---------------------------------------------------------------------------

class ExpressDepositRequest(BaseModel):
    ShortCode: str
    Amount: str
    PhoneNumber: str
    AccountNo: Optional[str] = None
    TransactionDesc: str
    OriginatorConversationId: str
    CallBackUrl: str
    type: Optional[int] = 0
    successRedirectUrl: Optional[str] = None
    failedRedirectUrl: Optional[str] = None
    serviceCode: Optional[str] = None
    currency: Optional[str] = "KES"
    firstName: Optional[str] = None
    lastName: Optional[str] = None


class ExpressDepositAcceptedMessage(BaseModel):
    appDomainName: str
    remarks: str
    originatorConversationId: str
    systemConversationId: str
    timestamp: str


class ExpressDepositAcceptedResponse(BaseModel):
    message: ExpressDepositAcceptedMessage


# ---------------------------------------------------------------------------
# Find Express Deposit — GET /v1/express-deposit/check-status
# ---------------------------------------------------------------------------

class ExpressDepositStatusResponse(BaseModel):
    conversationId: Optional[str] = None
    originatorConversationId: str
    merchantRequestID: Optional[str] = None
    phoneNumber: Optional[str] = None
    mpesaReceiptNumber: Optional[str] = None
    resultCode: str
    resultDesc: str
    status: str


# ---------------------------------------------------------------------------
# Payment Links — POST/GET/PUT /v1/payment-link/*
# ---------------------------------------------------------------------------

class CreatePaymentLinkRequest(BaseModel):
    shortCode: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    emailAddress: Optional[str] = None
    phoneNumber: Optional[str] = None
    accountReference: Optional[str] = None
    paymentType: Optional[str] = None
    description: Optional[str] = None
    isAmountSpecified: bool = False
    amount: Optional[int] = None
    currency: Optional[str] = "KES"
    redirectionSite: Optional[str] = None


class UpdatePaymentLinkRequest(BaseModel):
    id: str
    shortCode: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    emailAddress: Optional[str] = None
    phoneNumber: Optional[str] = None
    description: Optional[str] = None
    isAmountSpecified: Optional[bool] = None
    amount: Optional[int] = None
    redirectionSite: Optional[str] = None


# ---------------------------------------------------------------------------
# Balance Check — GET /v1/customer-accounts/get-wallet-balance
# ---------------------------------------------------------------------------

class CustomerAccountBalance(BaseModel):
    status: str
    message: Optional[str] = None
    balance: float
    type: int


class BalanceCheckResponse(BaseModel):
    customerAccountBalanceList: list[CustomerAccountBalance] = Field(default_factory=list)
    status: str
    balance: float


# ---------------------------------------------------------------------------
# Generic fallback
# ---------------------------------------------------------------------------

class RawZamuPayResponse(BaseModel):
    raw: dict[str, Any]
