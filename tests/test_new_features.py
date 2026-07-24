import pytest
from sqlalchemy.future import select
from app.models.user import User
from app.models.customer import Customer

@pytest.mark.asyncio
async def test_customer_crud_and_reports(client, db_session):
    # 1. Login as Admin
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin@karibucredit.co.ke", "password": "SuperSecret123!"}
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

    # 2. Create customer profile
    customer_payload = {
        "national_id": "99887766",
        "full_name": "Test Customer Profile",
        "phone": "+254711223344",
        "kra_pin": "A011223344B",
        "kyc_status": "VERIFIED",
        "credit_score": 750,
        "max_loan_limit": 500000.0,
    }
    
    response = await client.post("/api/v1/customers/", json=customer_payload, headers=headers)
    if response.status_code != 201:
        print("ERROR RESPONSE:", response.status_code, response.json())
    assert response.status_code == 201
    customer_data = response.json()
    assert customer_data["national_id"] == "99887766"
    assert customer_data["customer_code"].startswith("KC-")
    customer_id = customer_data["id"]

    # 3. Get customer profile
    response = await client.get(f"/api/v1/customers/{customer_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["full_name"] == "Test Customer Profile"

    # 4. List customers
    response = await client.get("/api/v1/customers/", headers=headers)
    assert response.status_code == 200
    customers = response.json()
    assert len(customers) > 0

    # 5. Update customer profile
    update_payload = {
        "credit_score": 800,
        "max_loan_limit": 600000.0
    }
    response = await client.put(f"/api/v1/customers/{customer_id}", json=update_payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["credit_score"] == 800
    assert response.json()["max_loan_limit"] == 600000.0

    # 6. Query Reports Metrics
    response = await client.get("/api/v1/reports/metrics", headers=headers)
    assert response.status_code == 200
    metrics = response.json()
    assert "total_disbursed" in metrics
    assert "repayment_rate" in metrics
    assert "par_30_ratio" in metrics

    # 7. Query Daily Summary Report
    response = await client.post("/api/v1/reports/daily-summary", headers=headers)
    # Since Celery might not be active, it will either trigger or run fallback
    assert response.status_code == 200
    assert response.json()["status"] in ["triggered", "completed"]

    # 8. Query Portfolio CSV
    response = await client.post("/api/v1/reports/portfolio-csv", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] in ["triggered", "completed"]
