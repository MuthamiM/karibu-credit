from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import date
from app.models.customer import Gender, KycStatus

class CustomerBase(BaseModel):
    national_id: str
    full_name: str
    phone: str
    kra_pin: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = Gender.MALE
    kyc_status: Optional[KycStatus] = KycStatus.PENDING
    credit_score: Optional[int] = 0
    max_loan_limit: Optional[float] = 0.0
    blacklisted: Optional[bool] = False
    blacklisted_reason: Optional[str] = None
    branch_id: Optional[int] = None
    is_repeat_borrower: Optional[bool] = False

class CustomerCreate(CustomerBase):
    user_id: Optional[int] = None

class CustomerUpdate(BaseModel):
    national_id: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    kra_pin: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    kyc_status: Optional[KycStatus] = None
    credit_score: Optional[int] = None
    max_loan_limit: Optional[float] = None
    blacklisted: Optional[bool] = None
    blacklisted_reason: Optional[str] = None
    branch_id: Optional[int] = None
    is_repeat_borrower: Optional[bool] = None

class CustomerResponse(CustomerBase):
    id: int
    customer_code: str
    user_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
