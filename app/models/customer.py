import enum
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, Enum, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"

class KycStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    customer_code = Column(String, unique=True, index=True, nullable=False) # KC-XXXXXXXXX
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Links to login credentials
    national_id = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, index=True, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False) # 2547XXXXXXXX
    kra_pin = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(Enum(Gender), default=Gender.MALE)
    kyc_status = Column(Enum(KycStatus), default=KycStatus.PENDING)
    credit_score = Column(Integer, default=0)
    max_loan_limit = Column(Float, default=0.0)
    blacklisted = Column(Boolean, default=False)
    blacklisted_reason = Column(String, nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    is_repeat_borrower = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="customer_profile")
    branch = relationship("Branch")
