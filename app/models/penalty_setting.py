from sqlalchemy import Column, Integer, Float, String
from app.db.base_class import Base

class PenaltySetting(Base):
    __tablename__ = "penalty_settings"

    id = Column(Integer, primary_key=True, index=True)
    grace_period = Column(Integer, default=3, nullable=False)
    penalty_percentage = Column(Float, default=10.0, nullable=False)
    frequency = Column(String, default="ONCE", nullable=False) # ONCE, DAILY, WEEKLY
