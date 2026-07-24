from pydantic import BaseModel, ConfigDict, Field
from app.models.penalty_setting import PenaltyFrequency


class PenaltySettingBase(BaseModel):
    grace_period: int = Field(..., ge=0, le=365, description="Days after due date before penalty kicks in")
    penalty_percentage: float = Field(..., ge=0.0, le=100.0, description="Penalty as % of outstanding balance")
    frequency: PenaltyFrequency = Field(PenaltyFrequency.ONCE, description="How often to apply: ONCE, DAILY, WEEKLY")


class PenaltySettingUpdate(PenaltySettingBase):
    pass


class PenaltySettingResponse(PenaltySettingBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

