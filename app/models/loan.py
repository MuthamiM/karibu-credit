import enum
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Date, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class LoanStatus(str, enum.Enum):
    PENDING = "pending"
    SCREENING = "screening"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    PARTIALLY_DISBURSED = "partially_disbursed"
    DISBURSED = "disbursed"
    ACTIVE = "active"
    RESTRUCTURED = "restructured"
    CLOSED = "closed"
    CLEARED = "cleared"
    DEFAULTED = "defaulted"
    WRITTEN_OFF = "written_off"
    REJECTED = "rejected"

class DisbursementMethod(str, enum.Enum):
    LUMP_SUM = "lump_sum"
    PARTIAL = "partial"
    STAGE_WISE = "stage_wise"

class TransactionType(str, enum.Enum):
    DISBURSEMENT = "disbursement"
    REPAYMENT = "repayment"
    PENALTY = "penalty"
    PLATFORM_FEE = "platform_fee"

class PaymentSource(str, enum.Enum):
    MPESA_C2B = "MPESA_C2B"
    MPESA_STK = "MPESA_STK"
    MPESA_B2B = "MPESA_B2B"
    MANUAL = "MANUAL"
    CHECKOFF = "CHECKOFF"

class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"
    REVERSED = "REVERSED"

class ScheduleStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    OVERDUE = "OVERDUE"

class CRBProvider(str, enum.Enum):
    TRANSUNION = "TRANSUNION"
    METROPOL = "METROPOL"

class CRBStatus(str, enum.Enum):
    CLEAR = "CLEAR"
    LISTED = "LISTED"
    NO_RECORD = "NO_RECORD"

class Loan(Base):
    __tablename__ = "loans"
    
    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String, unique=True, index=True, nullable=True) # LAF-XXXXXXXXX
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False) # Legacy reference
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("loan_products.id"), nullable=True)
    
    # Financial details
    principal_amount = Column(Float, nullable=False) # Maps to amount_requested or amount_approved
    amount_requested = Column(Float, nullable=True)
    amount_approved = Column(Float, nullable=True)
    amount_disbursed = Column(Float, default=0.0)
    outstanding_balance = Column(Float, default=0.0)
    interest_rate = Column(Float, nullable=False) # E.g., 5.0 for 5% per month
    tenure_months = Column(Integer, nullable=False)
    
    # State and configuration
    status = Column(Enum(LoanStatus), default=LoanStatus.PENDING, index=True)
    product_type = Column(String, nullable=False) # e.g., "logbook", "sme", "salary"
    disbursement_method = Column(Enum(DisbursementMethod), default=DisbursementMethod.LUMP_SUM)
    
    # Dates
    due_date = Column(DateTime(timezone=True), nullable=True) # Legacy reference
    disbursed_at = Column(DateTime(timezone=True), nullable=True)
    first_due_date = Column(Date, nullable=True)
    final_due_date = Column(Date, nullable=True)
    
    # Compliance & Staff tracking
    par_days = Column(Integer, default=0)
    officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    
    # Integrations
    kcb_reference = Column(String, nullable=True) # Populated after KCB bank disbursement
    mpesa_disbursement_ref = Column(String, nullable=True) # Safaricom B2C disbursement code
    
    # Metrics tracking
    total_payable = Column(Float, nullable=True)
    total_paid = Column(Float, default=0.0)
    penalty_balance = Column(Float, default=0.0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", foreign_keys=[user_id])
    officer = relationship("User", foreign_keys=[officer_id])
    customer = relationship("Customer")
    product = relationship("LoanProduct")
    branch = relationship("Branch")
    
    transactions = relationship("Transaction", back_populates="loan")
    collateral = relationship("Collateral", back_populates="loan", cascade="all, delete-orphan")
    repayment_schedules = relationship("RepaymentSchedule", back_populates="loan", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="loan", cascade="all, delete-orphan")

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

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    amount = Column(Float, nullable=False)
    principal_portion = Column(Float, default=0.0)
    interest_portion = Column(Float, default=0.0)
    fees_portion = Column(Float, default=0.0)
    mpesa_ref = Column(String, unique=True, index=True, nullable=False)
    source = Column(Enum(PaymentSource), nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    paid_at = Column(DateTime(timezone=True), server_default=func.now())
    
    loan = relationship("Loan", back_populates="payments")
    customer = relationship("Customer")

class RepaymentSchedule(Base):
    __tablename__ = "repayment_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=False)
    instalment_no = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)
    principal_due = Column(Float, nullable=False)
    interest_due = Column(Float, nullable=False)
    total_due = Column(Float, nullable=False)
    amount_paid = Column(Float, default=0.0)
    status = Column(Enum(ScheduleStatus), default=ScheduleStatus.PENDING)
    
    loan = relationship("Loan", back_populates="repayment_schedules")

class CreditScore(Base):
    __tablename__ = "credit_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=True)
    internal_score = Column(Integer, nullable=False)
    crb_score = Column(Integer, nullable=True)
    crb_provider = Column(Enum(CRBProvider), nullable=True)
    crb_status = Column(Enum(CRBStatus), default=CRBStatus.NO_RECORD)
    recommended_limit = Column(Float, default=0.0)
    scored_at = Column(DateTime(timezone=True), server_default=func.now())
    
    customer = relationship("Customer")
