import sqlite3
conn = sqlite3.connect('karibu.db')
cur = conn.cursor()
cur.execute("PRAGMA table_info(users);")
for row in cur.fetchall():
    print(row)
