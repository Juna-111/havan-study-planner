from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

API_PREFIX = "/api/v1"


class Settings(BaseSettings):
    app_name: str = "Havan Study Planner API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    default_timezone: str = Field("Africa/Addis_Ababa", validation_alias="DEFAULT_TIMEZONE")
    database_url: str = Field(
        "postgresql+psycopg://havan:havan@localhost:5432/havan_study_planner",
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
    password_reset_ttl_minutes: int = Field(10, validation_alias="PASSWORD_RESET_TTL_MINUTES")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    @model_validator(mode="before")
    @classmethod
    def reject_explicit_production_placeholder(cls, values: object) -> object:
        if isinstance(values, dict) and str(values.get("environment", "")).strip().lower() == "production":
            secret = values.get("auth_secret", values.get("AUTH_SECRET"))
            if secret == "change-this-secret-in-production" or (isinstance(secret, str) and len(secret) < 32):
                raise RuntimeError("AUTH_SECRET must be set to 32+ random characters")
        return values

    @model_validator(mode="after")
    def validate_production_secret(self) -> "Settings":
        if self.environment.strip().lower() == "production" and (
            self.auth_secret == "change-this-secret-in-production" or len(self.auth_secret) < 32
        ):
            raise RuntimeError("AUTH_SECRET must be set to 32+ random characters")
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
