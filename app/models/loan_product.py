import enum
from sqlalchemy import Column, Integer, String, Float, Boolean, Enum, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class ProductType(str, enum.Enum):
    LOGBOOK = "LOGBOOK"
    SME = "SME"
    SALARY = "SALARY"
    MOBILE = "MOBILE"
    TRADE = "TRADE"
    AGRI = "AGRI"
    HOUSING = "HOUSING"
    EDUCATION = "EDUCATION"

class InterestMethod(str, enum.Enum):
    FLAT = "FLAT"
    REDUCING_BALANCE = "REDUCING_BALANCE"

class LoanProduct(Base):
    __tablename__ = "loan_products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    type = Column(Enum(ProductType), nullable=False)
    min_amount = Column(Float, nullable=False)
    max_amount = Column(Float, nullable=False)
    interest_rate_monthly = Column(Float, nullable=False) # e.g. 5.0 for 5% p.m.
    interest_method = Column(Enum(InterestMethod), default=InterestMethod.FLAT)
    min_tenure_months = Column(Integer, nullable=False)
    max_tenure_months = Column(Integer, nullable=False)
    processing_fee_pct = Column(Float, default=0.0) # e.g. 3.0 for 3%
    requires_collateral = Column(Boolean, default=False)
    insurance_required = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
