import asyncio
from sqlalchemy import text
from app.db.session import engine

async def upgrade_db_disbursement():
    async with engine.begin() as conn:
        try:
            # Drop enum if exists and recreate or alter in Postgres
            # To be safe, we will just use VARCHAR for the new column down at the db level 
            # or recreate the type
            await conn.execute(text("ALTER TYPE loanstatus ADD VALUE IF NOT EXISTS 'partially_disbursed';"))
            await conn.execute(text("CREATE TYPE disbursementmethod AS ENUM ('lump_sum', 'partial', 'stage_wise');"))
        except Exception as e:
            print("Enum might already exist:", e)
            
        try:
            await conn.execute(text("ALTER TABLE loans ADD COLUMN disbursement_method disbursementmethod DEFAULT 'lump_sum';"))
            await conn.execute(text("ALTER TABLE loans ADD COLUMN amount_disbursed FLOAT DEFAULT 0.0;"))
            print("Successfully added disbursement columns!")
        except Exception as e:
            print("Error or columns exist:", e)

if __name__ == "__main__":
    asyncio.run(upgrade_db_disbursement())
