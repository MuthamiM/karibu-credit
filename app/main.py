from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.api import api_router  # touched again reload final

# Register all models for SQLAlchemy mapper config
from app.models.branch import Branch
from app.models.customer import Customer
from app.models.loan_product import LoanProduct
from app.models.loan import Loan, Transaction, Collateral, Payment, RepaymentSchedule, CreditScore
from app.models.audit_log import AuditLog
from app.models.penalty_setting import PenaltySetting
from app.models.user import User


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle events."""
    # ── Startup ──────────────────────────────────────────────────────
    from app.core.cache import init_redis
    try:
        await init_redis()
        print("Redis cache connected")
    except Exception as exc:
        print(f"Redis unavailable (cache disabled): {exc}")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    from app.core.cache import close_redis
    await close_redis()
    print("Redis cache disconnected")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Set CORS enabled origins for remote and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "project": "Karibu Credit API",
        "status": "online",
        "docs": "/docs",
        "api_v1": "/api/v1",
        "sms_endpoint": "/api/v1/sms/send",
    }

@app.get("/health-check")
def health_check():
    return {"status": "ok"}

@app.post("/send-sms")
@app.post("/send-otp")
@app.post("/send")
async def termux_gateway_sms_alias(payload: dict):
    """
    Convenience alias for Termux Gateway callers posting directly to root endpoints.
    """
    from app.integrations.otp_gateway import send_sms
    phone = payload.get("phone") or payload.get("to") or ""
    message = payload.get("message") or payload.get("text") or payload.get("code") or "OTP Code"
    if not phone:
        return {"status": "error", "detail": "Missing phone/to"}
    try:
        res = await send_sms(phone=str(phone), message=str(message))
        return {"status": "success", "result": res}
    except Exception as exc:
        return {"status": "queued_local", "detail": str(exc)}


@app.get("/cache/stats")
async def get_cache_stats():
    """Returns Redis cache hit/miss metrics and connectivity status."""
    from app.core.cache import cache_stats, get_redis
    stats = cache_stats()
    try:
        r = get_redis()
        info = await r.info(section="memory")
        stats["redis_connected"] = True
        stats["redis_memory_used"] = info.get("used_memory_human", "N/A")
        stats["redis_memory_peak"] = info.get("used_memory_peak_human", "N/A")
        keys_count = await r.dbsize()
        stats["total_cached_keys"] = keys_count
    except Exception:
        stats["redis_connected"] = False
    return stats


@app.get("/celery/status")
async def get_celery_status():
    """Returns basic Celery worker status by inspecting registered tasks."""
    from app.celery_app import celery_app
    try:
        inspector = celery_app.control.inspect(timeout=2.0)
        active = inspector.active()
        registered = inspector.registered()
        stats = inspector.stats()
        return {
            "status": "connected",
            "workers": list(stats.keys()) if stats else [],
            "active_tasks": {k: len(v) for k, v in active.items()} if active else {},
            "registered_tasks": registered or {},
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "error": str(exc),
            "hint": "Start worker: celery -A app.celery_app worker --loglevel=info",
        }


@app.get("/download-design-docx")
def download_design_docx():
    from fastapi.responses import FileResponse
    import os
    path = "docs/Karibu_Credit_Technical_Design_v1.docx"
    if os.path.exists(path):
        return FileResponse(
            path,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename="Karibu_Credit_Technical_Design_v1.docx"
        )
    return {"error": "File not found"}  # reload_trigger_17
