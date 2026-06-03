from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.models.group import GroupStatus, GroupMemberRole, GroupLoanStatus


class GroupCreate(BaseModel):
    group_name: str
    description: Optional[str] = None
    branch_id: Optional[int] = None
    max_members: int = 15


class GroupJoin(BaseModel):
    group_id: int
    customer_id: int
    role: GroupMemberRole = GroupMemberRole.MEMBER


class GroupLoanApply(BaseModel):
    group_id: int
    principal_amount: float
    interest_rate: float = 5.0  # Default 5% monthly
    tenure_months: int = 6
    purpose: Optional[str] = None


class GroupMemberResponse(BaseModel):
    id: int
    group_id: int
    customer_id: int
    role: GroupMemberRole
    is_active: bool
    joined_at: datetime
    customer_name: Optional[str] = None  # Populated from join

    model_config = ConfigDict(from_attributes=True)


class GroupLoanResponse(BaseModel):
    id: int
    group_id: int
    application_no: Optional[str] = None
    principal_amount: float
    interest_rate: float
    tenure_months: int
    total_payable: Optional[float] = None
    total_paid: float
    outstanding_balance: float
    status: GroupLoanStatus
    purpose: Optional[str] = None
    approved_by: Optional[int] = None
    disbursed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GroupResponse(BaseModel):
    id: int
    group_code: str
    group_name: str
    description: Optional[str] = None
    chairman_user_id: Optional[int] = None
    branch_id: Optional[int] = None
    status: GroupStatus
    max_members: int
    created_at: datetime
    member_count: Optional[int] = None
    total_loans: Optional[int] = None
    members: Optional[List[GroupMemberResponse]] = None
    group_loans: Optional[List[GroupLoanResponse]] = None

    model_config = ConfigDict(from_attributes=True)


class TopUpRequest(BaseModel):
    """Schema for requesting a loan top-up on an active loan."""
    top_up_amount: float
    additional_tenure_months: int = 0  # 0 means keep existing tenure, >0 extends
    reason: Optional[str] = None


class TopUpResponse(BaseModel):
    loan_id: int
    original_outstanding: float
    top_up_amount: float
    new_principal: float
    new_tenure_months: int
    new_total_payable: float
    new_monthly_installment: float
    status: str

    model_config = ConfigDict(from_attributes=True)
