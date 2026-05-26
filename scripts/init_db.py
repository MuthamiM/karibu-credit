import asyncio
import sys
import os

# Add the root directory to sys.path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.loan import Loan, Transaction, LoanStatus, TransactionType, Collateral
from app.models.audit_log import AuditLog
from app.models.penalty_setting import PenaltySetting
from app.db.base_class import Base

async def init_db():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=True)
    
    # 1. Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    SessionLocal = sessionmaker(
        bind=engine, class_=AsyncSession, autocommit=False, autoflush=False
    )
    
    # 2. Seed the initial Super Admin & Default Settings
    async with SessionLocal() as db:
        # Seed Super Admin
        result = await db.execute(select(User).where(User.email == "admin@karibucredit.co.ke"))
        user = result.scalars().first()
        
        if not user:
            print("Creating the first SUPER_ADMIN account...")
            super_admin = User(
                email="admin@karibucredit.co.ke",
                full_name="Chief Director",
                hashed_password=get_password_hash("SuperSecret123!"),
                role=UserRole.SUPER_ADMIN,
                is_active=True
            )
            db.add(super_admin)
            await db.commit()
            print("SUPER_ADMIN successfully created!")
            print("Login: admin@karibucredit.co.ke / SuperSecret123!")
        else:
            print("SUPER_ADMIN already exists.")
            
        # Seed Default Penalty Setting
        setting_res = await db.execute(select(PenaltySetting))
        setting = setting_res.scalars().first()
        if not setting:
            print("Creating default penalty settings...")
            default_setting = PenaltySetting(
                grace_period=3,
                penalty_percentage=10.0,
                frequency="ONCE"
            )
            db.add(default_setting)
            await db.commit()
            print("Default penalty settings created!")
        else:
            print("Penalty settings already exist.")


if __name__ == "__main__":
    asyncio.run(init_db())
