import pytest
from sqlalchemy.future import select
from app.models.user import User
from app.models.loan import Loan, LoanStatus, Payment, Transaction, RepaymentSchedule, ScheduleStatus
from app.models.customer import Customer
from app.models.loan_product import LoanProduct
from app.models.penalty_setting import PenaltySetting
from datetime import date, timedelta

@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health-check")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_login_success(client):
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin@karibucredit.co.ke", "password": "SuperSecret123!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["otp_required"] is True
    assert "pending_token" in data

    # Step 2: verify OTP to get access token
    verify_resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": data["pending_token"], "code": "123456"}
    )
    assert verify_resp.status_code == 200
    token_data = verify_resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_failure(client):
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin@karibucredit.co.ke", "password": "wrongpassword"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect email or password"

@pytest.mark.asyncio
async def test_admin_reset_password_success(client):
    # 1. Admin login
    login_res = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin@karibucredit.co.ke", "password": "SuperSecret123!"}
    )
    token_res = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": login_res.json()["pending_token"], "code": "123456"}
    )
    token = token_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Reset password for borrower (user_id = 3)
    reset_res = await client.post(
        "/api/v1/auth/admin/reset-password",
        headers=headers,
        json={"target_user_id": 3, "new_password": "NewSecretPassword123!"}
    )
    assert reset_res.status_code == 200
    assert reset_res.json() == {"status": "password reset", "user_id": 3}

    # 3. Verify borrower can login with new password
    borrower_login = await client.post(
        "/api/v1/auth/login",
        data={"username": "borrower@karibucredit.co.ke", "password": "NewSecretPassword123!"}
    )
    assert borrower_login.status_code == 200
    assert borrower_login.json()["otp_required"] is True

@pytest.mark.asyncio
async def test_admin_reset_password_forbidden(client):
    # 1. Officer login (non-admin)
    login_res = await client.post(
        "/api/v1/auth/login",
        data={"username": "officer@karibucredit.co.ke", "password": "SuperSecret123!"}
    )
    token_res = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": login_res.json()["pending_token"], "code": "123456"}
    )
    token = token_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Non-admin attempts reset password -> HTTP 403
    reset_res = await client.post(
        "/api/v1/auth/admin/reset-password",
        headers=headers,
        json={"target_user_id": 1, "new_password": "UnauthorizedPassword!"}
    )
    assert reset_res.status_code == 403
    assert reset_res.json()["detail"] == "Operation not permitted: insufficient privileges"

@pytest.mark.asyncio
async def test_otp_password_change_flow(client):
    # 1. Login as admin
    login_res = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin@karibucredit.co.ke", "password": "SuperSecret123!"}
    )
    token_res = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": login_res.json()["pending_token"], "code": "123456"}
    )
    access_token = token_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Request password change OTP
    req_otp_res = await client.post(
        "/api/v1/auth/request-password-change-otp",
        headers=headers
    )
    assert req_otp_res.status_code == 200
    otp_data = req_otp_res.json()
    assert otp_data["otp_required"] is True
    assert "pending_token" in otp_data

    # 3. Verify OTP for password reset (returns reset_token instead of access_token)
    verify_otp_res = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": otp_data["pending_token"], "code": "123456"}
    )
    assert verify_otp_res.status_code == 200
    confirm_data = verify_otp_res.json()
    assert confirm_data["otp_confirmed"] is True
    assert "reset_token" in confirm_data

    # 4. Complete password change
    complete_res = await client.post(
        "/api/v1/auth/complete-password-change",
        json={"reset_token": confirm_data["reset_token"], "new_password": "BrandNewPassword123!"}
    )
    assert complete_res.status_code == 200
    assert complete_res.json() == {"status": "success", "detail": "Password updated successfully"}

    # 5. Confirm user can now login with BrandNewPassword123!
    login_new = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin@karibucredit.co.ke", "password": "BrandNewPassword123!"}
    )
    assert login_new.status_code == 200

    # 6. Reset password back to SuperSecret123! for subsequent tests
    token_res_new = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": login_new.json()["pending_token"], "code": "123456"}
    )
    req_otp_res2 = await client.post(
        "/api/v1/auth/request-password-change-otp",
        headers={"Authorization": f"Bearer {token_res_new.json()['access_token']}"}
    )
    verify_otp_res2 = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": req_otp_res2.json()["pending_token"], "code": "123456"}
    )
    await client.post(
        "/api/v1/auth/complete-password-change",
        json={"reset_token": verify_otp_res2.json()["reset_token"], "new_password": "SuperSecret123!"}
    )





@pytest.mark.asyncio
async def test_get_products(client):
    response = await client.get("/api/v1/products/")
    assert response.status_code == 200
    products = response.json()
    assert len(products) > 0
    assert products[0]["name"] in ["Salary Loan", "Business / SME Loan"]

@pytest.mark.asyncio
async def test_calculate_amortization(client):
    payload = {
        "amount": 10000.0,
        "tenure_months": 6,
        "product_type": "salary"
    }
    response = await client.post("/api/v1/products/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["principal"] == 10000.0
    assert data["months"] == 6
    assert "schedule_lines" in data
    assert len(data["schedule_lines"]) == 6

@pytest.mark.asyncio
async def test_get_penalty_settings(client):
    # Log in to get pending token
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin@karibucredit.co.ke", "password": "SuperSecret123!"}
    )
    pending_token = login_response.json()["pending_token"]
    verify_resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": pending_token, "code": "123456"}
    )
    token = verify_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get("/api/v1/penalty-settings/", headers=headers)
    assert response.status_code == 200
    settings = response.json()
    assert settings["grace_period"] == 3
    assert settings["penalty_percentage"] == 10.0

@pytest.mark.asyncio
async def test_update_penalty_settings_unauthorized(client):
    response = await client.put(
        "/api/v1/penalty-settings/",
        json={"grace_period": 5, "penalty_percentage": 15.0, "frequency": "ONCE"}
    )
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_update_penalty_settings_authorized(client, db_session):
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin@karibucredit.co.ke", "password": "SuperSecret123!"}
    )
    pending_token = login_response.json()["pending_token"]
    verify_resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={"pending_token": pending_token, "code": "123456"}
    )
    token = verify_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await client.put(
        "/api/v1/penalty-settings/",
        headers=headers,
        json={"grace_period": 5, "penalty_percentage": 15.0, "frequency": "DAILY"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["grace_period"] == 5
    assert data["penalty_percentage"] == 15.0

@pytest.mark.asyncio
async def test_mpesa_validation(client):
    response = await client.post("/api/v1/webhooks/mpesa/c2b/validation", json={})
    assert response.status_code == 200
    assert response.json() == {"ResultCode": 0, "ResultDesc": "Accepted"}

@pytest.mark.asyncio
async def test_mpesa_confirmation_valid(client, db_session):
    result = await db_session.execute(select(User).where(User.email == "borrower@karibucredit.co.ke"))
    borrower = result.scalars().first()
    
    result_cust = await db_session.execute(select(Customer).where(Customer.user_id == borrower.id))
    customer = result_cust.scalars().first()
    
    result_prod = await db_session.execute(select(LoanProduct).where(LoanProduct.name == "Salary Loan"))
    product = result_prod.scalars().first()
    
    loan = Loan(
        application_no="LAF-12345678",
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
    
    schedule_line = RepaymentSchedule(
        loan_id=loan.id,
        instalment_no=1,
        due_date=date.today() + timedelta(days=30),
        principal_due=1666.67,
        interest_due=300.0,
        total_due=1966.67,
        amount_paid=0.0,
        status=ScheduleStatus.PENDING
    )
    db_session.add(schedule_line)
    await db_session.commit()
    
    payload = {
        "TransAmount": "1966.67",
        "TransID": "MPESAREF123",
        "BillRefNumber": str(loan.id),
        "MSISDN": "254712345678"
    }
    
    response = await client.post("/api/v1/webhooks/mpesa/c2b/confirmation", json=payload)
    assert response.status_code == 200
    assert response.json() == {"ResultCode": 0, "ResultDesc": "Success"}
    
    await db_session.refresh(loan)
    assert loan.total_paid == 1966.67
    assert loan.outstanding_balance == 12000.0 - 1966.67
    
    result_pay = await db_session.execute(select(Payment).where(Payment.loan_id == loan.id))
    payment = result_pay.scalars().first()
    assert payment is not None
    assert payment.amount == 1966.67
    assert payment.mpesa_ref == "MPESAREF123"
    
    result_tx = await db_session.execute(select(Transaction).where(Transaction.loan_id == loan.id))
    txs = result_tx.scalars().all()
    assert len(txs) == 2
    tx_types = [tx.type for tx in txs]
    assert "repayment" in tx_types
    assert "platform_fee" in tx_types
