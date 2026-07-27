from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from datetime import datetime, date
from app.models.loan import LoanStatus, TransactionType, DisbursementMethod, PaymentSource, PaymentStatus, ScheduleStatus, CRBProvider, CRBStatus
from app.models.loan_product import ProductType, InterestMethod
from app.models.customer import Gender, KycStatus

class BranchResponse(BaseModel):
    id: int
    name: str
    code: str
    location: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

from app.schemas.customer import CustomerResponse


class LoanProductResponse(BaseModel):
    id: int
    name: str
    type: ProductType
    min_amount: float
    max_amount: float
    interest_rate_monthly: float
    interest_method: InterestMethod
    min_tenure_months: int
    max_tenure_months: int
    processing_fee_pct: float
    requires_collateral: bool
    insurance_required: bool
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)

class PaymentResponse(BaseModel):
    id: int
    loan_id: int
    customer_id: int
    amount: float
    principal_portion: float
    interest_portion: float
    fees_portion: float
    mpesa_ref: str
    source: PaymentSource
    status: PaymentStatus
    paid_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class RepaymentScheduleResponse(BaseModel):
    id: int
    loan_id: int
    instalment_no: int
    due_date: date
    principal_due: float
    interest_due: float
    total_due: float
    amount_paid: float
    status: ScheduleStatus
    
    model_config = ConfigDict(from_attributes=True)

class LoanCreate(BaseModel):
    principal_amount: float
    tenure_months: int
    product_type: str
    disbursement_method: DisbursementMethod = DisbursementMethod.LUMP_SUM
    
class LoanCreateAdmin(BaseModel):
    borrower_id: int
    principal_amount: float
    interest_rate: float
    term_months: int
    loan_type: str
    disbursement_method: DisbursementMethod = DisbursementMethod.LUMP_SUM

class LoanResponse(BaseModel):
    id: int
    user_id: int
    customer_id: Optional[int] = None
    product_id: Optional[int] = None
    
    principal_amount: float
    amount_requested: Optional[float] = None
    amount_approved: Optional[float] = None
    amount_disbursed: float
    outstanding_balance: float
    interest_rate: float
    tenure_months: int
    status: LoanStatus
    product_type: str
    disbursement_method: DisbursementMethod
    
    due_date: Optional[datetime] = None
    disbursed_at: Optional[datetime] = None
    first_due_date: Optional[date] = None
    final_due_date: Optional[date] = None
    
    par_days: int
    officer_id: Optional[int] = None
    branch_id: Optional[int] = None
    
    zamupay_reference: Optional[str] = None
    mpesa_disbursement_ref: Optional[str] = None
    
    total_payable: Optional[float] = None
    total_paid: float
    penalty_balance: float
    created_at: datetime
    
    # Nested relations (optional for rich responses)
    customer: Optional[CustomerResponse] = None
    product: Optional[LoanProductResponse] = None
    branch: Optional[BranchResponse] = None
    repayment_schedules: Optional[List[RepaymentScheduleResponse]] = None
    
    model_config = ConfigDict(from_attributes=True)

class DisbursementRequest(BaseModel):
    amount: float
    reference_note: str

class AmortizationScheduleInfo(BaseModel):
    principal: float
    total_interest: float
    total_payable: float
    monthly_installment: float
    months: int
    schedule_lines: Optional[List[dict]] = None

class CRBCheckRequest(BaseModel):
    national_id: str

class CRBCheckResponse(BaseModel):
    national_id: str
    score: int
    grading: str
    listings: int
    amount_listed: str
    report_id: str
    timestamp: datetime

class CollateralCreate(BaseModel):
    type: str
    value: float
    details: Optional[str] = None
    status: Optional[str] = "PENDING"

class CollateralResponse(BaseModel):
    id: int
    loan_id: int
    type: str
    value: float
    status: str
    details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
