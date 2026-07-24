import sqlite3

conn = sqlite3.connect('karibu.db')
c = conn.cursor()
c.execute('SELECT id, role FROM users ORDER BY id')
rows = c.fetchall()
print('rows:')
for row in rows:
    print(row)
print('lowercase borrower count:', sum(1 for _, role in rows if role == 'borrower'))
print('uppercase BORROWER count:', sum(1 for _, role in rows if role == 'BORROWER'))
conn.close()
