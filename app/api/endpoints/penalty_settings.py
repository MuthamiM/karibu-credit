from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.penalty_setting import PenaltySetting
from app.schemas.penalty_setting import PenaltySettingResponse, PenaltySettingUpdate
from app.core.audit import log_audit_event

router = APIRouter()

@router.get("/", response_model=PenaltySettingResponse)
async def get_penalty_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get the global late payment penalty settings.
    Available to all authenticated users.
    """
    result = await db.execute(select(PenaltySetting))
    setting = result.scalars().first()
    
    if not setting:
        # Create default settings if none exist
        setting = PenaltySetting(
            grace_period=3,
            penalty_percentage=10.0,
            frequency="ONCE"
        )
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
        
    return setting

@router.put("/", response_model=PenaltySettingResponse)
async def update_penalty_settings(
    payload: PenaltySettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Update the global late payment penalty settings.
    Restricted to Admin / Super Admin.
    """
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update penalty settings."
        )
        
    result = await db.execute(select(PenaltySetting))
    setting = result.scalars().first()
    
    if not setting:
        setting = PenaltySetting(
            grace_period=payload.grace_period,
            penalty_percentage=payload.penalty_percentage,
            frequency=payload.frequency
        )
        db.add(setting)
    else:
        setting.grace_period = payload.grace_period
        setting.penalty_percentage = payload.penalty_percentage
        setting.frequency = payload.frequency
        
    await db.commit()
    await db.refresh(setting)
    
    await log_audit_event(
        db,
        user=current_user.email,
        action="UPDATE_PENALTY_SETTINGS",
        details=f"Updated Penalty Settings: Grace Period: {setting.grace_period} days, Penalty Rate: {setting.penalty_percentage}%, Frequency: {setting.frequency}"
    )
    
    return setting
