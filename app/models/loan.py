import enum
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class LoanStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PARTIALLY_DISBURSED = "partially_disbursed"
    DISBURSED = "disbursed"
    REJECTED = "rejected"
    CLEARED = "cleared"
    DEFAULTED = "defaulted"
    
class DisbursementMethod(str, enum.Enum):
    LUMP_SUM = "lump_sum"
    PARTIAL = "partial"
    STAGE_WISE = "stage_wise"
    
class TransactionType(str, enum.Enum):
    DISBURSEMENT = "disbursement"
    REPAYMENT = "repayment"
    PENALTY = "penalty"
    PLATFORM_FEE = "platform_fee"

class Loan(Base):
    __tablename__ = "loans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    principal_amount = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False) # E.g., 5.0 for 5% per month
    tenure_months = Column(Integer, nullable=False)
    status = Column(Enum(LoanStatus), default=LoanStatus.PENDING, index=True)
    product_type = Column(String, nullable=False) # e.g., "logbook", "sme", "salary"
    disbursement_method = Column(Enum(DisbursementMethod), default=DisbursementMethod.LUMP_SUM)
    kcb_reference = Column(String, nullable=True) # populated after successful disbursement via KCB
    
    # Track Repayments & End of Term
    due_date = Column(DateTime(timezone=True), nullable=True)
    total_payable = Column(Float, nullable=True)
    amount_disbursed = Column(Float, default=0.0)
    total_paid = Column(Float, default=0.0)
    penalty_balance = Column(Float, default=0.0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User")
    transactions = relationship("Transaction", back_populates="loan")
    collateral = relationship("Collateral", back_populates="loan", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    reference_code = Column(String, unique=True, index=True) # M-pesa Receipt No. or KCB Ref
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    loan = relationship("Loan", back_populates="transactions")

class Collateral(Base):
    __tablename__ = "collateral"
    
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=False)
    type = Column(String, nullable=False) # e.g. "Car Logbook", "Land Title Deed"
    value = Column(Float, nullable=False)
    status = Column(String, default="PENDING") # PENDING, VERIFIED, LIQUIDATED
    details = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    loan = relationship("Loan", back_populates="collateral")

