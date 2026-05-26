import asyncio
from sqlalchemy import text
from app.db.session import engine

async def upgrade_db():
    async with engine.begin() as conn:
        try:
            await conn.execute(text('ALTER TABLE loans ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;'))
            await conn.execute(text('ALTER TABLE loans ADD COLUMN total_payable FLOAT;'))
            await conn.execute(text('ALTER TABLE loans ADD COLUMN total_paid FLOAT DEFAULT 0.0;'))
            await conn.execute(text('ALTER TABLE loans ADD COLUMN penalty_balance FLOAT DEFAULT 0.0;'))
            print("Successfully added columns!")
        except Exception as e:
            print("Error or columns exist:", e)

if __name__ == "__main__":
    asyncio.run(upgrade_db())
