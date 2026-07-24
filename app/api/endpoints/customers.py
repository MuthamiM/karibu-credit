from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import random

from app.api import deps
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.customer import Customer, KycStatus
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.core.audit import log_audit_event

router = APIRouter()

@router.get("/", response_model=list[CustomerResponse])
async def list_customers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100,
    search: str | None = None
):
    """
    List all customer profiles. Restricted to staff and admins.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.COMPLIANCE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view customer profiles."
        )
        
    query = select(Customer)
    if search:
        query = query.where(Customer.full_name.icontains(search) | Customer.national_id.contains(search) | Customer.phone.contains(search))
        
    result = await db.execute(query.offset(skip).limit(limit))
    return list(result.scalars().all())

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Retrieve details of a specific customer profile.
    """
    # Borrowers can view their own profile, staff can view any
    query = select(Customer).where(Customer.id == customer_id)
    result = await db.execute(query)
    customer = result.scalars().first()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found."
        )
        
    if current_user.role == UserRole.BORROWER and customer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this customer profile."
        )
        
    return customer

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer_profile(
    payload: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Create a new customer profile manually. Restricted to staff.
    """
    if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to create customer profiles."
        )
        
    # Check if a customer with this national ID already exists
    nid_check = await db.execute(select(Customer).where(Customer.national_id == payload.national_id))
    if nid_check.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A customer with this National ID already exists."
        )
        
    # Check if a customer with this phone number already exists
    phone_check = await db.execute(select(Customer).where(Customer.phone == payload.phone))
    if phone_check.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A customer with this phone number already exists."
        )
        
    customer_code = f"KC-{random.randint(10000000, 99999999)}"
    
    db_customer = Customer(
        customer_code=customer_code,
        user_id=payload.user_id,
        national_id=payload.national_id,
        full_name=payload.full_name,
        phone=payload.phone,
        kra_pin=payload.kra_pin,
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        kyc_status=payload.kyc_status,
        credit_score=payload.credit_score,
        max_loan_limit=payload.max_loan_limit,
        blacklisted=payload.blacklisted,
        blacklisted_reason=payload.blacklisted_reason,
        branch_id=payload.branch_id,
        is_repeat_borrower=payload.is_repeat_borrower,
    )
    
    db.add(db_customer)
    await db.commit()
    await db.refresh(db_customer)
    
    await log_audit_event(
        db,
        user=current_user.email,
        action="CREATE_CUSTOMER_PROFILE",
        details=f"Manually created customer profile for {db_customer.full_name} (Code: {db_customer.customer_code})"
    )
    
    return db_customer

@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer_profile(
    customer_id: int,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Update a customer profile. Restricted to authorized staff.
    """
    query = select(Customer).where(Customer.id == customer_id)
    result = await db.execute(query)
    customer = result.scalars().first()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found."
        )
        
    # Check permissions
    if current_user.role == UserRole.BORROWER:
        if customer.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to update this profile."
            )
        # Borrowers can only update basic details
        allowed_fields = ["full_name", "phone", "kra_pin", "date_of_birth", "gender"]
        for field, value in payload.model_dump(exclude_unset=True).items():
            if field not in allowed_fields:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Borrowers are not allowed to update field: {field}"
                )
    else:
        # Staff can update anything
        if current_user.role not in [UserRole.LOAN_OFFICER, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.COMPLIANCE]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to update customer profiles."
            )
            
    # Update fields
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
        
    await db.commit()
    await db.refresh(customer)
    
    await log_audit_event(
        db,
        user=current_user.email,
        action="UPDATE_CUSTOMER_PROFILE",
        details=f"Updated customer profile for {customer.full_name} (Code: {customer.customer_code})"
    )
    
    return customer

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer_profile(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Delete a customer profile. Restricted to Super Admins.
    """
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can delete customer profiles."
        )
        
    query = select(Customer).where(Customer.id == customer_id)
    result = await db.execute(query)
    customer = result.scalars().first()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found."
        )
        
    await db.delete(customer)
    await db.commit()
    
    await log_audit_event(
        db,
        user=current_user.email,
        action="DELETE_CUSTOMER_PROFILE",
        details=f"Deleted customer profile: {customer.full_name} (Code: {customer.customer_code})"
    )
    
    return None
