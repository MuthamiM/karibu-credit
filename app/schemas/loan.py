from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.models.loan import LoanStatus, TransactionType, DisbursementMethod

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
    principal_amount: float
    interest_rate: float
    tenure_months: int
    status: LoanStatus
    product_type: str
    disbursement_method: DisbursementMethod
    kcb_reference: Optional[str] = None
    
    due_date: Optional[datetime] = None
    total_payable: Optional[float] = None
    amount_disbursed: float = 0.0
    total_paid: float = 0.0
    penalty_balance: float = 0.0
    
    created_at: datetime
    
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

