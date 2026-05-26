from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    user = Column(String, index=True, nullable=False) # Email of user/admin
    action = Column(String, index=True, nullable=False) # e.g. APPROVE_LOAN, ONBOARD_BORROWER
    details = Column(String, nullable=False)
    ip = Column(String, nullable=True)
