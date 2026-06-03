# Karibu Credit — Testing Guide

This guide describes how to run and extend the automated test suite for the Karibu Credit backend API.

---

## 🚀 Getting Started

### 1. Prerequisites

Ensure you have activated the virtual environment and installed the testing dependencies (`pytest` and `pytest-asyncio`):

```bash
# Windows (PowerShell):
.\venv\Scripts\activate
pip install pytest pytest-asyncio

# macOS/Linux:
source venv/bin/activate
pip install pytest pytest-asyncio
```

---

## 🏃 Run the Tests

To run the test suite, navigate to the project root directory and set the `PYTHONPATH` environment variable so Python can find the `app` package.

### Windows (PowerShell)
```powershell
$env:PYTHONPATH="."
.\venv\Scripts\pytest -v
```

### macOS / Linux / Git Bash
```bash
PYTHONPATH=. pytest -v
```

### Run a Specific Test File
```bash
# Windows
$env:PYTHONPATH="."
.\venv\Scripts\pytest tests/test_loan_engine.py -v
```

---

## 🧪 Test Architecture

The test suite is structured as follows:

```
tests/
├── conftest.py             # Global fixtures, test database setup, and client overrides
├── test_loan_engine.py     # Unit tests for the financial formulas & repayment allocations
└── test_api_endpoints.py   # Integration tests for FastAPI routers, auth, and webhooks
```

### Database Isolation

Tests run against a dedicated, isolated test database (`sqlite+aiosqlite:///./test_karibu.db`) to ensure your development database (`karibu.db`) is never contaminated. 

1. **Setup**: The `setup_test_db` fixture in `conftest.py` drops any existing test database tables and recreates them fresh before the session starts. It also seeds default branches, loan products, penalty settings, and test users.
2. **Transaction Rollbacks**: The `db_session` fixture yields an active database session and automatically issues a rollback after each test. This keeps each test isolated and extremely fast.
3. **Teardown**: The test database tables are dropped and the database file (`test_karibu.db`) is deleted from disk after the test session finishes.

---

## 🛠️ Adding New Tests

When adding new endpoints or calculations, create corresponding tests:

* **Unit Tests**: Place business calculations inside `tests/test_loan_engine.py`. Do not call the API client here unless necessary; keep them fast and pure.
* **API Tests**: Place API client requests in `tests/test_api_endpoints.py`. Make sure to use the `client` async fixture which automatically overrides dependency injection.
* **Authentication**: If your endpoint requires login, use the login logic from `test_update_penalty_settings_authorized` to obtain a JWT and append it to your request headers:
  ```python
  login_response = await client.post(
      "/api/v1/auth/login",
      data={"username": "admin@karibucredit.co.ke", "password": "SuperSecret123!"}
  )
  token = login_response.json()["access_token"]
  headers = {"Authorization": f"Bearer {token}"}
  response = await client.get("/api/v1/your-endpoint/", headers=headers)
  ```
