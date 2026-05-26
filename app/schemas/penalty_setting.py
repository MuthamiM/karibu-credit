from pydantic import BaseModel, ConfigDict

class PenaltySettingBase(BaseModel):
    grace_period: int
    penalty_percentage: float
    frequency: str # ONCE, DAILY, WEEKLY

class PenaltySettingUpdate(PenaltySettingBase):
    pass

class PenaltySettingResponse(PenaltySettingBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
