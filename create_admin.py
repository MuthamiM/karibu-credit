import sqlite3
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash("YourNewPassword123!")

conn = sqlite3.connect('karibu.db')
cur = conn.cursor()
cur.execute("""
    INSERT INTO users (email, full_name, phone_number, role, hashed_password, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
""", ("musa.admin@karibucredit.co.ke", "Musa Admin", "254114945842", "SUPER_ADMIN", hashed, 1))
conn.commit()
print("Created. New user ID:", cur.lastrowid)
