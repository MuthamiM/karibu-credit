from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.security import get_password_hash
from app.core.audit import log_audit_event
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse

router = APIRouter()

@router.post("/admin", response_model=UserResponse)
async def create_admin_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
    current_user: User = Depends(deps.get_current_super_admin),
):
    """
    Create a new admin/worker.
    Only users with the 'SUPER_ADMIN' role can invoke this endpoint to create another admin or staff member.
    """
    # Check if a user with this email already exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists in the system.",
        )
        
    db_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        phone_number=user_in.phone_number,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role, # Role sent by super admin
        is_active=True
    )
    
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    await log_audit_event(
        db,
        user=current_user.email,
        action="CREATE_ADMIN",
        details=f"Created administrative user {db_user.email} (Role: {db_user.role})"
    )
    return db_user

@router.post("/customer", response_model=UserResponse)
async def create_customer(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
    current_user: User = Depends(deps.get_current_active_user),
):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A customer with this email already exists",
        )
    
    db_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        phone_number=user_in.phone_number,
        hashed_password=get_password_hash(user_in.password),
        role=UserRole.BORROWER,
        is_active=True
    )
    
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    await log_audit_event(
        db,
        user=current_user.email,
        action="ONBOARD_BORROWER",
        details=f"Registered borrower customer profile: {db_user.email}"
    )
    return db_user

@router.get("/", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100,
    role: UserRole | None = None
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    result = await db.execute(query.offset(skip).limit(limit))
    return list(result.scalars().all())

@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Get current logged in user profile.
    """
    return current_user
