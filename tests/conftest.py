import asyncio
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.main import app
from app.db.base_class import Base
from app.db.session import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.branch import Branch
from app.models.customer import Customer, Gender, KycStatus
from app.models.loan_product import LoanProduct, ProductType, InterestMethod
from app.models.penalty_setting import PenaltySetting
from datetime import date

# Use a test SQLite database
TEST_DB_URI = "sqlite+aiosqlite:///./test_karibu.db"

# Create the test engine
test_engine = create_async_engine(TEST_DB_URI, echo=False)
TestingSessionLocal = sessionmaker(
    bind=test_engine, class_=AsyncSession, autocommit=False, autoflush=False, expire_on_commit=False
)

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    # Setup test database tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed base test data (branches, products, users, penalty settings)
    async with TestingSessionLocal() as db:
        # Seed branches
        branch_nrb = Branch(name="Nairobi Head Office", code="NRB-01", location="Upper Hill, Nairobi")
        db.add(branch_nrb)
        await db.commit()
        await db.refresh(branch_nrb)
        
        # Seed loan products
        products = [
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
        ]
        db.add_all(products)
        
        # Seed penalty settings
        default_setting = PenaltySetting(
            grace_period=3,
            penalty_percentage=10.0,
            frequency="ONCE"
        )
        db.add(default_setting)
        
        # Seed default users
        super_admin = User(
            email="admin@karibucredit.co.ke",
            full_name="Chief Administrator",
            hashed_password=get_password_hash("SuperSecret123!"),
            role=UserRole.SUPER_ADMIN,
            is_active=True
        )
        loan_officer = User(
            email="officer@karibucredit.co.ke",
            full_name="Officer Jane Mwangi",
            hashed_password=get_password_hash("SuperSecret123!"),
            role=UserRole.LOAN_OFFICER,
            is_active=True
        )
        borrower_user = User(
            email="borrower@karibucredit.co.ke",
            full_name="John Doe",
            phone_number="254712345678",
            hashed_password=get_password_hash("SuperSecret123!"),
            role=UserRole.BORROWER,
            is_active=True
        )
        
        db.add_all([super_admin, loan_officer, borrower_user])
        await db.commit()
        
        # Refresh and seed customer profile for John Doe
        await db.refresh(borrower_user)
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

    yield
    
    # Cleanup DB file after session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await test_engine.dispose()
    
    if os.path.exists("./test_karibu.db"):
        try:
            os.remove("./test_karibu.db")
        except PermissionError:
            pass

@pytest_asyncio.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session
        # We roll back at the end of each test to keep database clean
        await session.rollback()

@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
