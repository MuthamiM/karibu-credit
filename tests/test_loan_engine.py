import pytest
from app.core.loan_engine import (
    calculate_flat_rate_schedule,
    calculate_reducing_balance_schedule,
    allocate_repayment,
)

# Mock classes for testing allocate_repayment without requiring active database sessions
class MockRepaymentSchedule:
    def __init__(self, instalment_no, principal_due, interest_due, status="PENDING", amount_paid=0.0):
        self.instalment_no = instalment_no
        self.principal_due = principal_due
        self.interest_due = interest_due
        self.total_due = principal_due + interest_due
        self.status = status
        self.amount_paid = amount_paid

class MockLoan:
    def __init__(self, penalty_balance, outstanding_balance, schedules, status="ACTIVE"):
        self.penalty_balance = penalty_balance
        self.outstanding_balance = outstanding_balance
        self.repayment_schedules = schedules
        self.status = status
        self.total_paid = 0.0


def test_calculate_flat_rate_schedule():
    principal = 10000.0
    monthly_rate = 3.0
    months = 6
    
    result = calculate_flat_rate_schedule(principal, monthly_rate, months)
    
    # 3% of 10000 is 300 per month.
    # Total interest = 300 * 6 = 1800
    # Total payable = 11800
    # Monthly installment = 11800 / 6 = 1966.67 (rounded)
    assert result["principal"] == 10000.0
    assert result["total_interest"] == 1800.0
    assert result["total_payable"] == 11800.0
    assert result["monthly_installment"] == round(11800.0 / 6, 2)
    assert len(result["schedule_lines"]) == 6
    
    # Verify line items
    first_line = result["schedule_lines"][0]
    assert first_line["installment_no"] == 1
    assert first_line["principal_due"] == round(10000.0 / 6, 2)
    assert first_line["interest_due"] == 300.0
    assert first_line["total_due"] == round(11800.0 / 6, 2)
    
    last_line = result["schedule_lines"][-1]
    assert last_line["remaining_principal"] == 0.0


def test_calculate_reducing_balance_schedule():
    principal = 10000.0
    monthly_rate = 4.0
    months = 12
    
    result = calculate_reducing_balance_schedule(principal, monthly_rate, months)
    
    assert result["principal"] == 10000.0
    assert result["months"] == 12
    assert len(result["schedule_lines"]) == 12
    
    # Verify that remaining principal reaches 0
    last_line = result["schedule_lines"][-1]
    assert last_line["remaining_principal"] == 0.0
    
    # Check that EMI is constant
    emi = result["monthly_installment"]
    for line in result["schedule_lines"]:
        assert line["total_due"] == emi


def test_allocate_repayment_penalties_only():
    # Repayment is smaller than the penalty balance
    schedules = [MockRepaymentSchedule(1, 1000.0, 100.0)]
    loan = MockLoan(penalty_balance=500.0, outstanding_balance=1100.0, schedules=schedules)
    
    principal_p, interest_p, fees_p = allocate_repayment(loan, 200.0)
    
    assert fees_p == 200.0
    assert interest_p == 0.0
    assert principal_p == 0.0
    assert loan.penalty_balance == 300.0
    assert loan.total_paid == 200.0
    assert loan.outstanding_balance == 1100.0
    assert loan.status == "ACTIVE"


def test_allocate_repayment_penalties_and_part_schedule():
    # Repayment covers penalty and some of schedule interest
    schedules = [
        MockRepaymentSchedule(1, 1000.0, 200.0),
        MockRepaymentSchedule(2, 1000.0, 200.0)
    ]
    loan = MockLoan(penalty_balance=150.0, outstanding_balance=2400.0, schedules=schedules)
    
    # Send 300. 150 goes to penalties, 150 goes to Schedule 1 interest
    principal_p, interest_p, fees_p = allocate_repayment(loan, 300.0)
    
    assert fees_p == 150.0
    assert interest_p == 150.0
    assert principal_p == 0.0
    assert loan.penalty_balance == 0.0
    assert loan.total_paid == 300.0
    assert loan.outstanding_balance == 2250.0  # 2400 - (0 principal + 150 interest)
    assert schedules[0].status == "PARTIAL"
    assert schedules[0].amount_paid == 150.0


def test_allocate_repayment_covers_schedule_completely():
    schedules = [
        MockRepaymentSchedule(1, 1000.0, 200.0)
    ]
    loan = MockLoan(penalty_balance=0.0, outstanding_balance=1200.0, schedules=schedules)
    
    # Send 1200. 1200 covers Schedule 1 (1000 principal + 200 interest)
    principal_p, interest_p, fees_p = allocate_repayment(loan, 1200.0)
    
    assert fees_p == 0.0
    assert interest_p == 200.0
    assert principal_p == 1000.0
    assert loan.total_paid == 1200.0
    assert loan.outstanding_balance == 0.0
    assert schedules[0].status == "PAID"
    assert loan.status == "cleared"


def test_allocate_repayment_overpayment():
    schedules = [
        MockRepaymentSchedule(1, 1000.0, 200.0)
    ]
    loan = MockLoan(penalty_balance=0.0, outstanding_balance=1200.0, schedules=schedules)
    
    # Send 1500 (300 overpayment). Covers Schedule 1, remaining 300 goes to principal
    principal_p, interest_p, fees_p = allocate_repayment(loan, 1500.0)
    
    assert fees_p == 0.0
    assert interest_p == 200.0
    assert principal_p == 1300.0 # 1000 + 300 overpayment
    assert loan.outstanding_balance == 0.0
    assert loan.status == "cleared"
