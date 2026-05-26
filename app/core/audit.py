from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog

async def log_audit_event(
    db: AsyncSession,
    user: str,
    action: str,
    details: str,
    ip: str = None
) -> AuditLog:
    db_log = AuditLog(
        user=user,
        action=action,
        details=details,
        ip=ip
    )
    db.add(db_log)
    await db.commit()
    await db.refresh(db_log)
    return db_log
