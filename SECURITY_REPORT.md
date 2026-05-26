# Security Report — Karibu Credit

## Authentication
- **JWT tokens** with expiration for stateless API auth (`python-jose`)
- **Bcrypt password hashing** via `passlib` — passwords are never stored in plain text
- **Environment-based secrets** — `SECRET_KEY` and database credentials loaded from `.env`, never hardcoded

## Access Control (RBAC)
Every API endpoint enforces role checks. Users can only access what their role permits:

| Role | Can Access |
|------|-----------|
| `SUPER_ADMIN` | Everything — user management, settings, audit logs, disbursements |
| `ADMIN` | Collateral, penalty settings, audit logs |
| `FINANCE` | Loan stats, disbursements, transactions, penalty settings |
| `LOAN_OFFICER` | Loan management, collateral, audit logs |
| `BORROWER` | Own loans, loan applications |

## API Security
- **CORS** — only whitelisted origins can call the API
- **Input validation** — all requests validated through Pydantic schemas, preventing injection attacks
- **Parameterized queries** — SQLAlchemy ORM prevents SQL injection

## Audit Trail
All sensitive actions are logged to the `audit_logs` database table:
- Loan approvals, rejections, and applications
- Borrower onboarding and admin creation
- CRB credit checks
- Collateral attachments
- Penalty settings changes

Each log records: **who** (operator email), **what** (action), **when** (timestamp), and **details**.

## Data Protection
- `.env` file excluded from Git via `.gitignore`
- Database credentials never committed to source control
- Repository set to **private** on GitHub
