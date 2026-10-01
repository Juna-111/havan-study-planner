from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Havan Study Planner API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = Field(
        "postgresql+psycopg://havan:havan@localhost:5432/havan_study_planner",
        validation_alias="DATABASE_URL",
    )
    cors_origins: list[str] = Field(default=["http://localhost:3000"], validation_alias="CORS_ORIGINS")
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [x.strip() for x in value.split(",") if x.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
