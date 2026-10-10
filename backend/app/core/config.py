from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

API_PREFIX = "/api/v1"


def _default_pool_size(environment: str) -> int:
    return 15 if environment.strip().lower() == "production" else 5


class Settings(BaseSettings):
    app_name: str = "Havan Study Planner API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    default_timezone: str = Field("Africa/Addis_Ababa", validation_alias="DEFAULT_TIMEZONE")
    database_url: str = Field(
        "sqlite:///./havan_study_planner.db",
        validation_alias="DATABASE_URL",
    )
    cors_origins: Annotated[list[str], NoDecode] = Field(default=["http://localhost:3000"], validation_alias="CORS_ORIGINS")
    log_level: str = "INFO"
    auth_secret: str = Field("change-this-secret-in-production", validation_alias="AUTH_SECRET")
    admin_emails: Annotated[list[str], NoDecode] = Field(default_factory=list, validation_alias="ADMIN_EMAILS")
    auth_token_ttl_days: int = Field(30, validation_alias="AUTH_TOKEN_TTL_DAYS")
    smtp_host: str = Field("smtp.gmail.com", validation_alias="SMTP_HOST")
    smtp_port: int = Field(587, validation_alias="SMTP_PORT")
    smtp_user: str = Field("", validation_alias="SMTP_USER")
    smtp_password: str = Field("", validation_alias="SMTP_PASSWORD")
    smtp_from: str = Field("", validation_alias="SMTP_FROM")
    resend_api_key: str = Field("", validation_alias="RESEND_API_KEY")
    email_from: str = Field("", validation_alias="EMAIL_FROM")
    vapid_public_key: str = Field("", validation_alias="VAPID_PUBLIC_KEY")
    vapid_private_key: str = Field("", validation_alias="VAPID_PRIVATE_KEY")
    vapid_subject: str = Field("mailto:admin@havan.study", validation_alias="VAPID_SUBJECT")
    password_reset_ttl_minutes: int = Field(10, validation_alias="PASSWORD_RESET_TTL_MINUTES")
    db_pool_size: int = Field(default=3, validation_alias="DB_POOL_SIZE")
    db_max_overflow: int = Field(default=2, validation_alias="DB_MAX_OVERFLOW")
    db_pool_recycle: int = Field(default=1800, validation_alias="DB_POOL_RECYCLE")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    @model_validator(mode="after")
    def validate_production_requirements(self) -> "Settings":
        env = self.environment.strip().lower()
        if (
            self.auth_secret == "change-this-secret-in-production"
            or len(self.auth_secret) < 32
        ):
            if env == "production":
                raise RuntimeError("AUTH_SECRET must be set to 32+ random characters")
        if env == "production":
            tls_indicators = ("sslmode=require", "ssl=true", "sslmode=verify-full", "sslmode=verify-ca")
            if not any(indicator in self.database_url for indicator in tls_indicators):
                raise RuntimeError(
                    "DATABASE_URL must require TLS in production (include one of: sslmode=require, ssl=true, sslmode=verify-full, sslmode=verify-ca)"
                )
            if self.smtp_port not in (465, 587):
                raise RuntimeError("SMTP_PORT must be 465 or 587 in production")
            if self.resend_api_key.strip():
                if not self.email_from.strip():
                    raise RuntimeError("EMAIL_FROM must be set when RESEND_API_KEY is configured")
            elif not self.smtp_user.strip() or not self.smtp_password.strip():
                raise RuntimeError("Configure RESEND_API_KEY and EMAIL_FROM, or SMTP_USER and SMTP_PASSWORD, in production")
        return self

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        if isinstance(value, str):
            if value.startswith("postgres://"):
                return "postgresql+psycopg://" + value[len("postgres://"):]
            if value.startswith("postgresql://"):
                return "postgresql+psycopg://" + value[len("postgresql://"):]
            if value.startswith("postgresql+psycopg2://"):
                return "postgresql+psycopg://" + value[len("postgresql+psycopg2://"):]
        return value

    @field_validator("admin_emails", mode="before")
    @classmethod
    def parse_admin_emails(cls, value: object) -> object:
        if isinstance(value, str):
            return [x.strip().lower() for x in value.split(",") if x.strip()]
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [x.strip().rstrip("/") for x in value.split(",") if x.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
