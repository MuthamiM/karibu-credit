import asyncio
from app.db.session import SessionLocal

# Import all models so SQLAlchemy can resolve relationship strings
from app.models import user, customer, loan, loan_product, branch, group, audit_log, penalty_setting

from app.models.user import User, UserRole
from app.core.security import get_password_hash


async def main():
    async with SessionLocal() as session:
        u = User(
            email="admin@karibucredit.co.ke",
            full_name="Musa Admin",
            phone_number="254114945842",
            role=UserRole.SUPER_ADMIN,
            hashed_password=get_password_hash("SuperSecret123!"),
            is_active=True,
        )
        session.add(u)
        await session.commit()
        await session.refresh(u)
        print("Created. New user ID:", u.id)


if __name__ == "__main__":
    asyncio.run(main())
