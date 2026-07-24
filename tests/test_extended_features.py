import pytest
from sqlalchemy.future import select
from datetime import date, timedelta
from app.models.user import User, UserRole
from app.models.customer import Customer
from app.models.loan_product import LoanProduct
from app.models.loan import Loan, LoanStatus, RepaymentSchedule, ScheduleStatus
from app.models.group import LendingGroup, GroupMember, GroupLoan, GroupStatus, GroupMemberRole, GroupLoanStatus

@pytest.mark.asyncio
async def test_group_lending_lifecycle(client, db_session):
    # 1. Log in as loan officer to create group
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "officer@karibucredit.co.ke", "password": "SuperSecret123!"}
    )
    assert login_response.status_code == 200
    pending_token = login_response.json()["pending_token"]
    verify_resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": pending_token, "code": "123456"}
    )
    assert verify_resp.status_code == 200
    token = verify_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch branch to use
    from app.models.branch import Branch
    branch_res = await db_session.execute(select(Branch))
    branch = branch_res.scalars().first()
    assert branch is not None

    # Create Group
    group_payload = {
        "group_name": "Kibera Women Self Help Group",
        "description": "Lending group for women entrepreneurs in Kibera",
        "branch_id": branch.id,
        "max_members": 10
    }
    create_response = await client.post("/api/v1/groups/create", json=group_payload, headers=headers)
    assert create_response.status_code == 200
    group_data = create_response.json()
    group_id = group_data["id"]
    assert group_data["group_name"] == "Kibera Women Self Help Group"
    assert group_data["member_count"] == 0

    # Retrieve borrower customer
    cust_res = await db_session.execute(select(Customer))
    customer1 = cust_res.scalars().first()
    assert customer1 is not None

    # Try to add a member
    join_payload = {
        "group_id": group_id,
        "customer_id": customer1.id,
        "role": "chairman"
    }
    join_response = await client.post("/api/v1/groups/join", json=join_payload, headers=headers)
    assert join_response.status_code == 200
    assert join_response.json()["role"] == "chairman"

    # Attempt to apply for group loan with only 1 member (should fail - needs at least 3)
    loan_payload = {
        "group_id": group_id,
        "principal_amount": 30000.0,
        "interest_rate": 2.5,
        "tenure_months": 6,
        "purpose": "Business stock expansion"
    }
    loan_response_fail = await client.post("/api/v1/groups/apply", json=loan_payload, headers=headers)
    assert loan_response_fail.status_code == 400
    assert "at least 3 active members" in loan_response_fail.json()["detail"]

    # Create two more users/customers to meet the 3 members minimum
    user2 = User(
        email="borrower2@karibucredit.co.ke",
        full_name="Jane Doe",
        phone_number="254712345679",
        hashed_password="hashed_password",
        role=UserRole.BORROWER,
        is_active=True
    )
    user3 = User(
        email="borrower3@karibucredit.co.ke",
        full_name="Mary Smith",
        phone_number="254712345680",
        hashed_password="hashed_password",
        role=UserRole.BORROWER,
        is_active=True
    )
    db_session.add_all([user2, user3])
    await db_session.commit()
    await db_session.refresh(user2)
    await db_session.refresh(user3)

    customer2 = Customer(
        customer_code="KC-00000002",
        user_id=user2.id,
        national_id="87654321",
        full_name="Jane Doe",
        phone="254712345679",
        date_of_birth=date(1992, 8, 20),
        branch_id=branch.id
    )
    customer3 = Customer(
        customer_code="KC-00000003",
        user_id=user3.id,
        national_id="11223344",
        full_name="Mary Smith",
        phone="254712345680",
        date_of_birth=date(1988, 11, 5),
        branch_id=branch.id
    )
    db_session.add_all([customer2, customer3])
    await db_session.commit()
    await db_session.refresh(customer2)
    await db_session.refresh(customer3)

    # Join the other two members to the group
    await client.post("/api/v1/groups/join", json={"group_id": group_id, "customer_id": customer2.id, "role": "secretary"}, headers=headers)
    await client.post("/api/v1/groups/join", json={"group_id": group_id, "customer_id": customer3.id, "role": "member"}, headers=headers)

    # Now apply for group loan (should succeed)
    loan_response_success = await client.post("/api/v1/groups/apply", json=loan_payload, headers=headers)
    assert loan_response_success.status_code == 200
    loan_data = loan_response_success.json()
    assert loan_data["principal_amount"] == 30000.0
    assert loan_data["status"] == "pending"

    # Get group details to verify members list & loan history inclusion
    details_response = await client.get(f"/api/v1/groups/{group_id}", headers=headers)
    assert details_response.status_code == 200
    details_data = details_response.json()
    assert details_data["member_count"] == 3
    assert len(details_data["members"]) == 3
    assert len(details_data["group_loans"]) == 1
    assert details_data["group_loans"][0]["principal_amount"] == 30000.0


@pytest.mark.asyncio
async def test_loan_topup_lifecycle(client, db_session):
    # Log in as loan officer
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "officer@karibucredit.co.ke", "password": "SuperSecret123!"}
    )
    assert login_response.status_code == 200
    pending_token = login_response.json()["pending_token"]
    verify_resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": pending_token, "code": "123456"}
    )
    assert verify_resp.status_code == 200
    token = verify_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch user, customer and product
    user_res = await db_session.execute(select(User).where(User.email == "borrower@karibucredit.co.ke"))
    borrower = user_res.scalars().first()
    cust_res = await db_session.execute(select(Customer).where(Customer.user_id == borrower.id))
    customer = cust_res.scalars().first()
    prod_res = await db_session.execute(select(LoanProduct).where(LoanProduct.name == "Salary Loan"))
    product = prod_res.scalars().first()

    # Create an active loan
    loan = Loan(
        application_no="LAF-999999",
        user_id=borrower.id,
        customer_id=customer.id,
        product_id=product.id,
        principal_amount=10000.0,
        outstanding_balance=12000.0,
        interest_rate=3.0,
        tenure_months=6,
        status=LoanStatus.DISBURSED,
        product_type="salary",
        total_payable=12000.0,
        total_paid=0.0,
        penalty_balance=0.0
    )
    db_session.add(loan)
    await db_session.commit()
    await db_session.refresh(loan)

    # Seed 6 schedule lines
    for i in range(1, 7):
        sched = RepaymentSchedule(
            loan_id=loan.id,
            instalment_no=i,
            due_date=date.today() + timedelta(days=30 * i),
            principal_due=1666.67,
            interest_due=300.0,
            total_due=1966.67,
            amount_paid=0.0,
            status=ScheduleStatus.PENDING
        )
        db_session.add(sched)
    await db_session.commit()

    # Try applying for top-up when paid is 0% (should fail)
    topup_payload = {
        "top_up_amount": 5000.0,
        "additional_tenure_months": 2,
        "reason": "Family emergency extension"
    }
    topup_fail = await client.post(f"/api/v1/loans/{loan.id}/top-up", json=topup_payload, headers=headers)
    assert topup_fail.status_code == 400
    assert "Insufficient repayment history" in topup_fail.json()["detail"]

    # Simulating paying 60% of the loan (e.g. paying 7200.0 KES of 12000.0 KES)
    loan.total_paid = 7200.0
    loan.outstanding_balance = 12000.0 - 7200.0  # 4800.0 remaining
    db_session.add(loan)
    await db_session.commit()

    # Now apply for top-up (should succeed)
    topup_success = await client.post(f"/api/v1/loans/{loan.id}/top-up", json=topup_payload, headers=headers)
    assert topup_success.status_code == 200
    data = topup_success.json()
    assert data["loan_id"] == loan.id
    assert data["original_outstanding"] == 4800.0
    assert data["top_up_amount"] == 5000.0
    assert data["new_principal"] == 9800.0  # 4800 remaining principal + 5000 top up
    assert data["new_tenure_months"] == 8   # 6 + 2 additional tenure

    # Verify database updates
    await db_session.refresh(loan)
    assert loan.principal_amount == 9800.0
    assert loan.tenure_months == 8
    
    # Check that old pending schedules are closed, and new ones are created
    sched_res = await db_session.execute(select(RepaymentSchedule).where(RepaymentSchedule.loan_id == loan.id))
    schedules = sched_res.scalars().all()
    
    # 6 old schedules + 8 new schedules = 14 total schedules in db
    assert len(schedules) == 14
    
    # The new pending schedules should match new principal and tenure
    new_pending = [s for s in schedules if s.status == ScheduleStatus.PENDING]
    assert len(new_pending) == 8
