import secrets
from typing import Any, Union
from pydantic import AnyHttpUrl, EmailStr, validator
from pydantic_settings import BaseSettings

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

    @validator("BACKEND_CORS_ORIGINS", pre=True)
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

    # DATABASES
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "karibu_db"
    SQLALCHEMY_DATABASE_URI: str | None = None

    @validator("SQLALCHEMY_DATABASE_URI", pre=True)
    def assemble_db_connection(cls, v: str | None, values: dict[str, Any]) -> Any:
        if isinstance(v, str):
            return v
        return f"postgresql+asyncpg://{values.get('POSTGRES_USER')}:{values.get('POSTGRES_PASSWORD')}@{values.get('POSTGRES_SERVER')}/{values.get('POSTGRES_DB')}"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
