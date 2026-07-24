import sqlite3

conn = sqlite3.connect('karibu.db')
cur = conn.cursor()
cur.execute("SELECT id, email, phone_number, role, is_active FROM users WHERE email LIKE 'musa%'")
rows = cur.fetchall()
for r in rows:
    print(r)
