import asyncio
import sys
import os
from datetime import date

# Add the root directory to sys.path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.branch import Branch
from app.models.customer import Customer, Gender, KycStatus
from app.models.loan_product import LoanProduct, ProductType, InterestMethod
from app.models.loan import Loan, Transaction, Collateral, Payment, RepaymentSchedule, CreditScore
from app.models.audit_log import AuditLog
from app.models.penalty_setting import PenaltySetting
from app.db.base_class import Base

async def init_db():
    print("Connecting to database at:", settings.SQLALCHEMY_DATABASE_URI)
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=True)
    
    # 1. Create tables
    print("Rebuilding tables...")
    async with engine.begin() as conn:
        # Drop all tables first for a clean revamp
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Tables rebuilt successfully.")
        
    SessionLocal = sessionmaker(
        bind=engine, class_=AsyncSession, autocommit=False, autoflush=False, expire_on_commit=False
    )
    
    async with SessionLocal() as db:
        # 2. Seed Regional Branches
        print("Seeding branches...")
        branch_nrb = Branch(name="Nairobi Head Office", code="NRB-01", location="Upper Hill, Nairobi")
        branch_msa = Branch(name="Mombasa Branch", code="MSA-01", location="Mombasa CBD")
        branch_ksm = Branch(name="Kisumu Branch", code="KSM-01", location="Kisumu Lake Basin")
        db.add_all([branch_nrb, branch_msa, branch_ksm])
        await db.commit()
        await db.refresh(branch_nrb)
        print("Branches seeded.")

        # 3. Seed Loan Products
        print("Seeding loan products...")
        products = [
            LoanProduct(
                name="Logbook Loan",
                type=ProductType.LOGBOOK,
                min_amount=50000.0,
                max_amount=5000000.0,
                interest_rate_monthly=3.5,
                interest_method=InterestMethod.REDUCING_BALANCE,
                min_tenure_months=1,
                max_tenure_months=24,
                processing_fee_pct=3.0,
                requires_collateral=True,
                insurance_required=True,
                is_active=True
            ),
            LoanProduct(
                name="Business / SME Loan",
                type=ProductType.SME,
                min_amount=10000.0,
                max_amount=5000000.0,
                interest_rate_monthly=4.0,
                interest_method=InterestMethod.REDUCING_BALANCE,
                min_tenure_months=1,
                max_tenure_months=36,
                processing_fee_pct=2.5,
                requires_collateral=True,
                insurance_required=True,
                is_active=True
            ),
            LoanProduct(
                name="Salary Loan",
                type=ProductType.SALARY,
                min_amount=5000.0,
                max_amount=1000000.0,
                interest_rate_monthly=3.0,
                interest_method=InterestMethod.FLAT,
                min_tenure_months=1,
                max_tenure_months=12,
                processing_fee_pct=2.0,
                requires_collateral=False,
                insurance_required=True,
                is_active=True
            ),
            LoanProduct(
                name="Mobile Instant Loan (KaribuKash)",
                type=ProductType.MOBILE,
                min_amount=500.0,
                max_amount=100000.0,
                interest_rate_monthly=5.0,
                interest_method=InterestMethod.FLAT,
                min_tenure_months=1,
                max_tenure_months=3,
                processing_fee_pct=1.0,
                requires_collateral=False,
                insurance_required=False,
                is_active=True
            ),
            LoanProduct(
                name="Trade Finance (Bid/Performance Bonds)",
                type=ProductType.TRADE,
                min_amount=50000.0,
                max_amount=10000000.0,
                interest_rate_monthly=2.5,
                interest_method=InterestMethod.FLAT,
                min_tenure_months=1,
                max_tenure_months=6,
                processing_fee_pct=1.5,
                requires_collateral=True,
                insurance_required=False,
                is_active=True
            ),
            LoanProduct(
                name="Agribusiness Seasonal Loan",
                type=ProductType.AGRI,
                min_amount=5000.0,
                max_amount=2000000.0,
                interest_rate_monthly=3.0,
                interest_method=InterestMethod.FLAT,
                min_tenure_months=1,
                max_tenure_months=12,
                processing_fee_pct=2.0,
                requires_collateral=True,
                insurance_required=True,
                is_active=True
            ),
            LoanProduct(
                name="Housing Construction Loan",
                type=ProductType.HOUSING,
                min_amount=100000.0,
                max_amount=10000000.0,
                interest_rate_monthly=3.0,
                interest_method=InterestMethod.REDUCING_BALANCE,
                min_tenure_months=6,
                max_tenure_months=36,
                processing_fee_pct=3.0,
                requires_collateral=True,
                insurance_required=True,
                is_active=True
            ),
            LoanProduct(
                name="Education Fees Loan",
                type=ProductType.EDUCATION,
                min_amount=2000.0,
                max_amount=500000.0,
                interest_rate_monthly=2.0,
                interest_method=InterestMethod.FLAT,
                min_tenure_months=1,
                max_tenure_months=12,
                processing_fee_pct=2.0,
                requires_collateral=False,
                insurance_required=False,
                is_active=True
            ),
        ]
        db.add_all(products)
        await db.commit()
        print("Loan products seeded.")

        # 4. Seed Default Users (Super Admin, Loan Officer, Customer User)
        print("Seeding administrative & staff user accounts...")
        
        super_admin = User(
            email="admin@karibucredit.co.ke",
            full_name="Chief Administrator",
            hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
            role=UserRole.SUPER_ADMIN,
            is_active=True
        )
        
        loan_officer = User(
            email="officer@karibucredit.co.ke",
            full_name="Officer Jane Mwangi",
            hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
            role=UserRole.LOAN_OFFICER,
            is_active=True
        )
        
        borrower_user = User(
            email="borrower@karibucredit.co.ke",
            full_name="John Doe",
            phone_number="254712345678",
            hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
            role=UserRole.BORROWER,
            is_active=True
        )
        
        db.add_all([super_admin, loan_officer, borrower_user])
        await db.commit()
        await db.refresh(borrower_user)
        print("Users successfully created.")

        # 5. Seed Customer Profile for John Doe (KC-00000001)
        print("Seeding customer profile...")
        john_customer = Customer(
            customer_code="KC-00000001",
            user_id=borrower_user.id,
            national_id="12345678",
            full_name="John Doe",
            phone="254712345678",
            kra_pin="A001234567B",
            date_of_birth=date(1990, 5, 12),
            gender=Gender.MALE,
            kyc_status=KycStatus.VERIFIED,
            credit_score=720,
            max_loan_limit=250000.0,
            branch_id=branch_nrb.id,
            is_repeat_borrower=False
        )
        db.add(john_customer)
        await db.commit()
        print("Customer profile seeded.")

        # 6. Seed Default Penalty Settings
        print("Seeding default late-payment penalty settings...")
        default_setting = PenaltySetting(
            grace_period=3,
            penalty_percentage=10.0,
            frequency="ONCE"
        )
        db.add(default_setting)
        
        # Log event in Audit Log
        event = AuditLog(
            user="system",
            action="SYSTEM_INIT",
            details="Database bootstrapped and mock seed data successfully loaded."
        )
        db.add(event)
        
        await db.commit()
        print("Default penalty settings and initial audit trail log written.")
        print("Database bootstrap successfully completed!")

if __name__ == "__main__":
    asyncio.run(init_db())
