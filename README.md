# Karibu Credit — Loan Distribution Platform

A modern, secure, and clean web application for managing loan disbursements, borrower onboarding, risk management (CRB checks), collateral tracking, and automated late-payment penalty administration.

---

## 🏗️ Project Architecture

This repository is organized as a monorepo containing both the backend and admin dashboard:

- **Backend (`/app`):** Built with Python, FastAPI, and SQLAlchemy (SQLite for development). Features RBAC security, JWT auth, and interactive OpenAPI swagger documentation.
- **Frontend (`/web-admin`):** Built with Next.js, React, TypeScript, and TailwindCSS. Highly interactive dashboard with real-time statistics, charts, and API integrations.

---

## 🔐 Credentials (Development)

Use these credentials to log into the Admin Dashboard:
- **Email:** `admin@karibucredit.co.ke`
- **Password:** `SuperSecret123!`

---

## 🛠️ Quick Start

### 1. Run the Backend API

1. Activate the Python virtual environment:
   ```bash
   # Windows:
   .\venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
2. Start the Uvicorn dev server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
3. Interactive API documentation is available at:
   - **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 2. Run the Next.js Frontend

1. Navigate to the frontend directory:
   ```bash
   cd web-admin
   ```
2. Run the dev server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌟 Core Features

- **Audit Logs:** Immutable tracking of user actions (loan approvals, borrower onboarding, policy updates, etc.) persisted in the backend database.
- **Collateral Ledger:** Appraise, track, and attach physical/digital assets directly to active loans.
- **Late Payment Penalty Settings:** Dynamic grace period and penalty percentage rate configuration from the UI. Calculates penalties dynamically using a daily background cron check.
- **Credit Reference Bureau (CRB) Checks:** On-demand API validation of borrower risk before issuing loans.
- **Flexible Disbursements:** Streamlined tracking of stage-wise or partial tranches.
