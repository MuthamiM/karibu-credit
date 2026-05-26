# Karibu Credit Backend 🚀

This is the backend system for the Karibu Credit loan distribution platform. It is built using Python, FastAPI, and PostgreSQL to ensure speed, security, and scalability.

## 📚 API Documentation (Swagger UI)

FastAPI automatically generates interactive API documentation.
Once you start the server, you can view the fully documented API here:
👉 **http://127.0.0.1:8000/docs**

If you prefer ReDoc format, you can visit:
👉 **http://127.0.0.1:8000/redoc**

## 🏗️ Project Structure

The project follows a standard modern Python layout:

```text
karibuInc/
│
├── app/
│   ├── core/           # Core configurations and security functions
│   │   ├── config.py   # Global environment variables and settings
│   │   └── security.py # Password hashing and JWT generation
│   │
│   ├── models/         # Database models (SQLAlchemy) - *Coming Next*
│   ├── schemas/        # Pydantic validation models - *Coming Next*
│   ├── api/            # API routing and endpoints - *Coming Next*
│   └── main.py         # Main FastAPI application instance
│
├── venv/               # Python Virtual Environment
├── SECURITY_REPORT.md  # Detailed security implementation report
└── README.md           # This file
```

## 🛠️ How to run the local server

1. Activate your virtual environment: 
   - Windows: `.\venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`

2. Run the Uvicorn server:
   ```bash
   uvicorn app.main:app --reload
   ```

3. The server will start on `http://127.0.0.1:8000`. You can check the health check endpoint at `http://127.0.0.1:8000/health-check`

## 🔒 Security Features Built-in

- **JWT Authentication:** Secure API endpoints requiring tokens.
- **Bcrypt Hashing:** Passwords are salted and hashed.
- **Pydantic Validation:** All payloads are strictly typed and validated to prevent injection attacks.
- **CORS Mitigation:** Restricts access to allowed frontend domains.
