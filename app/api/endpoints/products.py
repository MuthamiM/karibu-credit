from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from pydantic import BaseModel

from app.api import deps
from app.db.session import get_db
from app.models.loan_product import LoanProduct, ProductType, InterestMethod
from app.schemas.loan import LoanProductResponse, AmortizationScheduleInfo
from app.core import loan_engine

router = APIRouter()

class CalculatorRequest(BaseModel):
    amount: float
    tenure_months: int
    product_type: str

@router.get("/", response_model=List[LoanProductResponse])
async def list_active_products(db: AsyncSession = Depends(get_db)):
    """
    List all active Karibu Credit loan products with their configuration parameters.
    """
    result = await db.execute(select(LoanProduct).where(LoanProduct.is_active == True))
    return result.scalars().all()

@router.get("/{product_id}", response_model=LoanProductResponse)
async def get_product_details(product_id: int, db: AsyncSession = Depends(get_db)):
    """
    Fetch details for a single loan product.
    """
    result = await db.execute(select(LoanProduct).where(LoanProduct.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Loan product not found")
    return product

@router.post("/calculate", response_model=AmortizationScheduleInfo)
async def calculate_schedule_simulation(
    calc_in: CalculatorRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Public Amortization Calculator:
    Calculates principal, total interest, monthly installments, and schedules using Flat or Reducing Balance.
    """
    # Fetch product by type (matching case-insensitively or standardizing)
    normalized_type = calc_in.product_type.upper()
    
    result = await db.execute(
        select(LoanProduct).where(LoanProduct.type == normalized_type, LoanProduct.is_active == True)
    )
    product = result.scalars().first()
    if not product:
        # Fallback to standard SME if product not registered, for sandbox flexibility
        product = LoanProduct(
            name="SME Sandbox Fallback",
            type=ProductType.SME,
            interest_rate_monthly=4.0,
            interest_method=InterestMethod.REDUCING_BALANCE,
            min_tenure_months=1,
            max_tenure_months=36
        )
    
    # Check boundaries
    if hasattr(product, 'min_amount') and (calc_in.amount < product.min_amount or calc_in.amount > product.max_amount):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Amount must be between KES {product.min_amount:,.2f} and KES {product.max_amount:,.2f} for {product.name}."
        )
        
    if hasattr(product, 'min_tenure_months') and (calc_in.tenure_months < product.min_tenure_months or calc_in.tenure_months > product.max_tenure_months):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenure must be between {product.min_tenure_months} and {product.max_tenure_months} months."
        )

    # Perform calculation depending on product interest method
    if product.interest_method == InterestMethod.REDUCING_BALANCE:
        schedule = loan_engine.calculate_reducing_balance_schedule(
            principal=calc_in.amount,
            monthly_rate_pct=product.interest_rate_monthly,
            months=calc_in.tenure_months
        )
    else:
        schedule = loan_engine.calculate_flat_rate_schedule(
            principal=calc_in.amount,
            monthly_rate_pct=product.interest_rate_monthly,
            months=calc_in.tenure_months
        )
        
    return schedule
