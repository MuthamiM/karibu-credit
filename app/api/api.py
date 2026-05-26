from fastapi import APIRouter

from app.api.endpoints import auth, users, loans, webhooks, audit, penalty_settings

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users & Staff"])
api_router.include_router(loans.router, prefix="/loans", tags=["Loans & Appraisals"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Bank & Daraja Webhooks"])
api_router.include_router(audit.router, prefix="/audit", tags=["Compliance Audit Logs"])
api_router.include_router(penalty_settings.router, prefix="/penalty-settings", tags=["Penalty Settings"])

