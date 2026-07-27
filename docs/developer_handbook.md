# Karibu Credit — Developer Handbook

This handbook contains technical documentation for developers onboarding or maintaining the Karibu Credit platform.

---

## 🏗️ Architectural Design

Karibu Credit is a loan distribution and management platform built as a monorepo:

* **Backend (`/app`)**: Built with **Python**, **FastAPI**, **SQLAlchemy** (async connection via `asyncpg`/`aiosqlite`), and **Pydantic** for validation. Runs on port `8000`.
* **Admin Dashboard (`/web-admin`)**: Built with **Next.js 16** (App Router), **React 19**, and **Tailwind CSS v4**. Communicates with the backend using a shared token-based API client at `/lib/api.ts`. Runs on port `3000`.

---

## 💾 Database Configuration

The system supports two database modes:

### 1. SQLite (Local Development)
* **Default**: Used for quick local setup.
* **Configured via**: `.env` (`SQLALCHEMY_DATABASE_URI=sqlite+aiosqlite:///./karibu.db`).
* **Seeding**: Initialize or reset the local SQLite database by running the seed script:
  ```powershell
  # Windows
  .\venv\Scripts\python.exe scripts/init_db.py
  ```

### 2. PostgreSQL (Production / Docker)
* **Configured via**: `app/core/config.py` default settings.
* **Service**: Defined in `docker-compose.yml` (`postgres:15-alpine`).
* **Startup**: Start the PostgreSQL container:
  ```bash
  docker-compose up -d
  ```

---

## 🔐 Security & Role-Based Access Control (RBAC)

Authentication is handled via JWT tokens (signed with HMAC-SHA256). 
The `UserRole` enum (`app/models/user.py`) defines roles used to restrict endpoint access via dependencies in `app/api/deps.py`:

* `SUPER_ADMIN` / `ADMIN`: Complete system access, policy setting management, and user onboarding.
* `LOAN_OFFICER`: Process and review loan applications, register collateral, and run credit reports.
* `FINANCE`: Disburse tranches, view transactions, and modify settings.
* `BORROWER` / `CUSTOMER`: View their own active loans, schedules, and repayment history.

---

## 🧮 Loan Calculations & Engine

All financial formulas are contained in `app/core/loan_engine.py`:

### 1. Flat Rate Schedule
* Interest is calculated once on the initial principal and divided equally across all installments:
  $$\text{Interest Per Month} = \text{Principal} \times \left(\frac{\text{Monthly Rate}}{100}\right)$$
  $$\text{Total Interest} = \text{Interest Per Month} \times \text{Tenure Months}$$
  $$\text{Total Payable} = \text{Principal} + \text{Total Interest}$$

### 2. Reducing Balance (EMI)
* Standard equated monthly installments where interest is computed on the reducing outstanding principal balance:
  $$\text{EMI} = P \times \frac{r(1+r)^n}{(1+r)^n - 1}$$
  *Where $P$ is principal, $r$ is monthly interest rate as decimal, and $n$ is months.*

### 3. Repayment Allocation Waterfall
Incoming payments (from M-Pesa webhooks) are allocated in the following order:
1. **Outstanding Penalties / Fees**: Settles any late fees first.
2. **Scheduled Installments**: Splits the remainder across outstanding installments chronologically (interest portion first, then principal portion per installment line).
3. **Overpayment**: Any remaining amount is deducted directly from the global outstanding loan principal.
4. **Auto-Clearing**: If the outstanding balance hits $\le 0$, the loan status is updated to `cleared`.

---

## 🔌 Third-Party Integrations

### 1. Safaricom M-Pesa (Daraja API)
* **Webhook endpoints**: `/api/v1/webhooks/mpesa/c2b/validation` and `/api/v1/webhooks/mpesa/c2b/confirmation`.
* **Validation**: Validates that the payment is valid.
* **Confirmation**: Receives successful Paybill payments, parses the payload using `DarajaGateway`, matches the `BillRefNumber` to the `Loan.id`, allocates repayment via the loan engine, and inserts transaction records.

### 2. ZamuPay API Gateway
* **Class**: `ZamuPayClient` (`app/integrations/zamupay/client.py`).
* **Function**: Handles automated B2C loan disbursements and repayment STK pushes.
* **Sandbox**: Integrates with ZamuPay Sandbox endpoints with credentials managed via environment variables.

---

## 🕒 Cron Jobs & Nightly Tasks

### Daily Penalties script (`scripts/daily_penalties.py`)
Runs nightly to apply late-payment fees:
1. Queries the database for all `disbursed` / `active` loans past their `due_date`.
2. Applies a penalty rate (configured in `PenaltySetting`) if the customer has passed the configured grace period.
3. Sets the loan status to `DEFAULTED` and creates a `PENALTY` transaction record.
