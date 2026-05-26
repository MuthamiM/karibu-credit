from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.api import api_router

# Register all models for SQLAlchemy mapper config
from app.models.branch import Branch
from app.models.customer import Customer
from app.models.loan_product import LoanProduct
from app.models.loan import Loan, Transaction, Collateral, Payment, RepaymentSchedule, CreditScore
from app.models.audit_log import AuditLog
from app.models.penalty_setting import PenaltySetting
from app.models.user import User

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set CORS enabled origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin).rstrip("/") for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health-check")
def health_check():
    return {"status": "ok"}
