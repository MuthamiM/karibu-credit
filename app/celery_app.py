"""
Celery application factory for Karibu Credit.
Configured to use Redis as both broker and result backend.
"""

from celery import Celery
from celery.schedules import crontab

# Import settings — use a direct read from .env to avoid circular imports
# with FastAPI's async runtime.
import os
from dotenv import load_dotenv

load_dotenv()

BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

celery_app = Celery(
    "karibu_worker",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=[
        "app.tasks.penalty_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.report_tasks",
    ],
)

# ─── Celery Configuration ────────────────────────────────────────────────
celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Nairobi",
    enable_utc=True,

    # Result expiry
    result_expires=3600,  # 1 hour

    # Worker settings
    worker_concurrency=4,
    worker_prefetch_multiplier=1,
    task_acks_late=True,

    # Retry policy
    task_default_retry_delay=60,
    task_max_retries=3,

    # Task routing
    task_routes={
        "app.tasks.penalty_tasks.*": {"queue": "penalties"},
        "app.tasks.notification_tasks.*": {"queue": "notifications"},
        "app.tasks.report_tasks.*": {"queue": "reports"},
    },
)

# ─── Periodic Beat Schedule ──────────────────────────────────────────────
celery_app.conf.beat_schedule = {
    "calculate-daily-penalties": {
        "task": "app.tasks.penalty_tasks.calculate_daily_penalties",
        "schedule": crontab(hour=2, minute=0),  # Every day at 2:00 AM EAT
        "options": {"queue": "penalties"},
    },
    "send-payment-reminders": {
        "task": "app.tasks.notification_tasks.send_payment_reminders",
        "schedule": crontab(hour=8, minute=0),  # Every day at 8:00 AM EAT
        "options": {"queue": "notifications"},
    },
    "generate-daily-summary-report": {
        "task": "app.tasks.report_tasks.generate_daily_summary",
        "schedule": crontab(hour=6, minute=0),  # Every day at 6:00 AM EAT
        "options": {"queue": "reports"},
    },
}
