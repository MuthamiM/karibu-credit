from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

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
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum records to return"),
    action: Optional[str] = Query(None, description="Filter by action type, e.g. APPROVE_LOAN"),
    user: Optional[str] = Query(None, description="Filter by user email (partial match)"),
):
    """
    Retrieve paginated audit compliance logs.
    Supports optional filtering by action type and user email.
    Restricted to Admin, Super Admin, Finance, and Loan Officers.
    """
    if current_user.role not in [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.FINANCE,
        UserRole.LOAN_OFFICER,
    ]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view audit compliance logs.",
        )

    query = select(AuditLog).order_by(AuditLog.timestamp.desc())

    if action:
        # Case-insensitive exact match on the action field
        query = query.where(AuditLog.action.ilike(action.strip()))

    if user:
        # Partial match on the user email
        query = query.where(AuditLog.user.ilike(f"%{user.strip()}%"))

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all())
