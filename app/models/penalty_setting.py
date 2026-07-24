import enum
from sqlalchemy import Column, Integer, Float, String, Enum
from app.db.base_class import Base


class PenaltyFrequency(str, enum.Enum):
    ONCE = "ONCE"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"


class PenaltySetting(Base):
    __tablename__ = "penalty_settings"

    id = Column(Integer, primary_key=True, index=True)
    grace_period = Column(Integer, default=3, nullable=False)
    penalty_percentage = Column(Float, default=10.0, nullable=False)
    frequency = Column(Enum(PenaltyFrequency), default=PenaltyFrequency.ONCE, nullable=False)

