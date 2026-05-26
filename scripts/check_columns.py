from app.models.loan import Loan
print("Loan model columns:")
for col in Loan.__table__.columns:
    print(f"- {col.name}: {col.type}")
