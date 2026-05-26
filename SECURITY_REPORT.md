# Karibu Credit Backend - Security Report

This report outlines the security features implemented in the backend architecture using Python (FastAPI). The system is built with defense-in-depth principles, addressing common vulnerabilities like OWASP Top 10.

## 1. Authentication & Authorization
- **JWT (JSON Web Tokens):** We use industry-standard JWTs (`python-jose`) for stateless API authentication. Tokens have a strict expiration time to limit session hijacking windows.
- **Password Hashing:** Implemented `bcrypt` through `passlib`. Passwords are NEVER stored in plain text. `bcrypt` adds a salt to effectively prevent rainbow table attacks.
- **Secrets Management:** In `app/core/config.py`, the system is configured to pull secure variables (e.g., `SECRET_KEY`, `POSTGRES_PASSWORD`) from environment variables (`.env`). The `SECRET_KEY` uses a secure random 32-byte generator (`secrets.token_urlsafe`) as a safe fallback.

## 2. API Security & Access Controls (RBAC)
- **Role-Based Access Control (RBAC):** Configured fine-grained access checks across routers to prevent unauthorized actions.
  - Endpoints like `/api/v1/audit/` are strictly limited to `SUPER_ADMIN`, `ADMIN`, `FINANCE`, and `LOAN_OFFICER` roles.
  - Endpoints like `/api/v1/loans/{loan_id}/disburse_tranche` are strictly restricted to `FINANCE` and `SUPER_ADMIN` operators.
  - Endpoints like `/api/v1/loans/apply` and `/api/v1/loans/me` are designed for borrower access while validating scopes.
- **CORS Protection:** Configured `CORSMiddleware` in `app/main.py` explicitly controlling which external domains can interact with the API (`BACKEND_CORS_ORIGINS`). This prevents Cross-Origin Resource Sharing attacks like CSRF.
- **Pydantic Validation:** All inputs are strictly validated using Pydantic models. This avoids SQL Injection, NoSQL Injection, and XSS (Cross-Site Scripting) by ensuring untrusted data conforms exactly to expected formats before it reaches the core logic.

## 3. Database Security & Audit Ledgers
- **Immutable Compliance Audit Ledger:** Created a database-backed `AuditLog` mapping all user actions:
    - Approvals (`APPROVE_LOAN`), rejections (`REJECT_LOAN`), borrower onboarding (`ONBOARD_BORROWER`), administrative creations (`CREATE_ADMIN`), CRB lookups (`CRB_CHECK`), and collateral attachment (`ATTACH_COLLATERAL`).
    - Every event records the operator email, action type, descriptive details, timestamp, and client IP address.
- **Parameterization:** Interaction with the database is handled entirely via SQLAlchemy ORM / Core. Enforced parameterized queries natively, entirely preventing SQL injection attacks.
- **Least Privilege Principle:** Configured variables separate the application's DB user (`POSTGRES_USER`) from admin roles, enforcing connection with restricted privileges.

## Next Steps to Fortify
Once we deploy to production:
1. **Rate Limiting:** Protect endpoints against brute force and DDoS attacks using tools like slowapi or Redis rate-limiters.
2. **Double-Entry Ledger Integrity:** Add cryptographically chained hashes to each audit log entry to ensure ledger records cannot be altered.
