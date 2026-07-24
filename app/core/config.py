import secrets
from typing import Any, Union
from pydantic import AnyHttpUrl, EmailStr, field_validator, ValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict
import dotenv
dotenv.load_dotenv(override=True)

class Settings(BaseSettings):
    """
    Application settings and configuration.
    Loads variables from the environment or a .env file.
    """
    PROJECT_NAME: str = "Karibu Credit Backend"
    API_V1_STR: str = "/api/v1"

    # SECURITY
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # CORS
    BACKEND_CORS_ORIGINS: list[AnyHttpUrl] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, list[str]]) -> Union[list[str], str]:
        """
        Validates and parses the CORS origins from a string or list.
        Expects a comma-separated list of URLs in the environment variable.
        """
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]

        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Default password used by init_db.py to seed admin accounts
    DEFAULT_ADMIN_PASSWORD: str = "change_me_in_production"

    # KCB API Gateway
    KCB_CLIENT_ID: str = ""
    KCB_CLIENT_SECRET: str = ""

    # OTP GATEWAY
    OTP_GATEWAY_URL: str = "https://excavate-undying-atom.ngrok-free.dev"
    OTP_GATEWAY_USER: str = "sms"
    OTP_GATEWAY_PASS: str = "OTP"
    OTP_PENDING_TOKEN_EXPIRE_MINUTES: int = 5

    # DATABASES
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "karibu_db"
    SQLALCHEMY_DATABASE_URI: str | None = None

    # REDIS & CELERY
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"


    @field_validator("SQLALCHEMY_DATABASE_URI", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str | None, info: ValidationInfo) -> Any:
        if isinstance(v, str):
            return v
        return f"postgresql+asyncpg://{info.data.get('POSTGRES_USER')}:{info.data.get('POSTGRES_PASSWORD')}@{info.data.get('POSTGRES_SERVER')}/{info.data.get('POSTGRES_DB')}"

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore"
    )

settings = Settings()
