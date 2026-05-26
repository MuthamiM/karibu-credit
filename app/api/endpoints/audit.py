from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse

router = APIRouter()

@router.get("/", response_model=list[AuditLogResponse])
async def read_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get audit compliance logs.
    Restricted to Admin, Super Admin, Finance, and Loan Officers.
    """
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE, UserRole.LOAN_OFFICER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view audit compliance logs."
        )

    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())
