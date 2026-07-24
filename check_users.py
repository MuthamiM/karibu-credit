import sqlite3
conn = sqlite3.connect('karibu.db')
cur = conn.cursor()
cur.execute("SELECT id, email, phone_number, role FROM users LIMIT 20;")
for row in cur.fetchall():
    print(row)
