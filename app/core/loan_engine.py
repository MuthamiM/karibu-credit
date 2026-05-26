def calculate_flat_rate_schedule(principal: float, monthly_rate_pct: float, months: int) -> dict:
    """
    Calculates a flat rate amortization schedule.
    Interest is calculated once on the initial principal and divided equally.
    """
    interest_per_month = principal * (monthly_rate_pct / 100)
    total_interest = interest_per_month * months
    total_payable = principal + total_interest
    monthly_installment = total_payable / months
    
    principal_per_month = principal / months
    
    schedule_lines = []
    remaining_principal = principal
    for i in range(1, months + 1):
        remaining_principal -= principal_per_month
        if remaining_principal < 0 or i == months:
            remaining_principal = 0.0
            
        schedule_lines.append({
            "installment_no": i,
            "principal_due": round(principal_per_month, 2),
            "interest_due": round(interest_per_month, 2),
            "total_due": round(monthly_installment, 2),
            "remaining_principal": round(remaining_principal, 2)
        })
        
    return {
        "principal": round(principal, 2),
        "total_interest": round(total_interest, 2),
        "total_payable": round(total_payable, 2),
        "monthly_installment": round(monthly_installment, 2),
        "months": months,
        "schedule_lines": schedule_lines
    }

def calculate_reducing_balance_schedule(principal: float, monthly_rate_pct: float, months: int) -> dict:
    """
    Calculates a reducing balance amortization schedule (standard equated monthly installment - EMI).
    Interest is calculated monthly on the outstanding principal balance.
    """
    r = monthly_rate_pct / 100
    n = months
    if r == 0:
        emi = principal / n
    else:
        emi = principal * (r * ((1 + r) ** n)) / (((1 + r) ** n) - 1)
    
    total_payable = emi * n
    total_interest = total_payable - principal
    
    schedule_lines = []
    remaining_principal = principal
    for i in range(1, n + 1):
        interest_payment = remaining_principal * r
        principal_payment = emi - interest_payment
        remaining_principal -= principal_payment
        if remaining_principal < 0 or i == n:
            principal_payment += remaining_principal
            remaining_principal = 0.0
            
        schedule_lines.append({
            "installment_no": i,
            "principal_due": round(principal_payment, 2),
            "interest_due": round(interest_payment, 2),
            "total_due": round(emi, 2),
            "remaining_principal": round(remaining_principal, 2)
        })
        
    return {
        "principal": round(principal, 2),
        "total_interest": round(total_interest, 2),
        "total_payable": round(total_payable, 2),
        "monthly_installment": round(emi, 2),
        "months": months,
        "schedule_lines": schedule_lines
    }

def allocate_repayment(loan, amount: float) -> tuple[float, float, float]:
    """
    Allocates an incoming payment amount across the loan penalty balance,
    outstanding repayment schedules, and outstanding principal.
    Returns: (principal_portion, interest_portion, fees_portion)
    """
    original_amount = amount
    principal_portion = 0.0
    interest_portion = 0.0
    fees_portion = 0.0
    
    # 1. Settle outstanding fees/penalties first
    if loan.penalty_balance > 0:
        if amount <= loan.penalty_balance:
            fees_portion = amount
            loan.penalty_balance -= amount
            amount = 0.0
        else:
            fees_portion = loan.penalty_balance
            amount -= loan.penalty_balance
            loan.penalty_balance = 0.0
            
    # 2. Settle outstanding schedules (interest first, then principal per schedule line)
    if amount > 0 and loan.repayment_schedules:
        # Sort schedules by installment_no
        sorted_schedules = sorted(loan.repayment_schedules, key=lambda s: s.instalment_no)
        for sched in sorted_schedules:
            if amount <= 0:
                break
                
            # If already paid fully, skip
            if sched.status == "PAID" or sched.amount_paid >= sched.total_due:
                continue
                
            outstanding = sched.total_due - sched.amount_paid
            if amount >= outstanding:
                # Settle this installment fully
                payment_to_sched = outstanding
                sched.amount_paid = sched.total_due
                sched.status = "PAID"
                amount -= payment_to_sched
                
                # Determine how much goes to interest vs principal
                interest_outstanding = max(0.0, sched.interest_due - (sched.amount_paid - payment_to_sched)) # mock calculation
                interest_to_pay = min(interest_outstanding, payment_to_sched)
                principal_to_pay = payment_to_sched - interest_to_pay
                
                interest_portion += interest_to_pay
                principal_portion += principal_to_pay
            else:
                # Settle this installment partially
                sched.amount_paid += amount
                sched.status = "PARTIAL"
                
                # Settle interest first
                interest_to_pay = min(sched.interest_due, amount)
                principal_to_pay = amount - interest_to_pay
                
                interest_portion += interest_to_pay
                principal_portion += principal_to_pay
                amount = 0.0
                break
                
    # 3. Handle overpayment (remainder goes directly to principal)
    if amount > 0:
        principal_portion += amount
        amount = 0.0
        
    # Update global loan state
    loan.total_paid += original_amount
    loan.outstanding_balance = max(0.0, loan.outstanding_balance - (principal_portion + interest_portion))
    
    if loan.outstanding_balance <= 0:
        loan.status = "cleared" # LoanStatus.CLEARED
        
    return (round(principal_portion, 2), round(interest_portion, 2), round(fees_portion, 2))
