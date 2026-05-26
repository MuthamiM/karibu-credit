def calculate_flat_rate_schedule(principal: float, monthly_rate_pct: float, months: int) -> dict:
    """
    Calculates a simple flat rate amortization schedule commonly used in Microfinance 
    for Logbook and active SME loans.
    """
    interest_per_month = principal * (monthly_rate_pct / 100)
    total_interest = interest_per_month * months
    total_payable = principal + total_interest
    monthly_installment = total_payable / months
    
    return {
        "principal": principal,
        "total_interest": total_interest,
        "total_payable": total_payable,
        "monthly_installment": monthly_installment,
        "months": months
    }
