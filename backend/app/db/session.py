from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

_settings = get_settings()

_sqlite_db_path = None
if "sqlite" in _settings.database_url.lower():
    db_target = _settings.database_url.replace("sqlite:///./", "", 1).replace("sqlite:///", "", 1)
    _sqlite_db_path = (Path(__file__).resolve().parents[2] / db_target).resolve()
    if _sqlite_db_path.exists() and _sqlite_db_path.is_file() and not str(_sqlite_db_path).startswith(":memory:"):
        try:
            import sqlite3
            with sqlite3.connect(_sqlite_db_path) as conn:
                cols = conn.execute("PRAGMA table_info(student_accounts)").fetchall()
                has_role = any(column[1] == "role" for column in cols)
            if not has_role:
                _sqlite_db_path.unlink(missing_ok=True)
        except Exception:
            pass

env = _settings.environment.strip().lower()
_pool_size = _settings.db_pool_size if _settings.db_pool_size != 5 or env != "production" else 15
_max_overflow = _settings.db_max_overflow if _settings.db_max_overflow != 10 or env != "production" else 20
_pool_recycle = _settings.db_pool_recycle

engine = create_engine(
    _settings.database_url,
    pool_pre_ping=True,
    pool_size=_pool_size,
    max_overflow=_max_overflow,
    pool_recycle=_pool_recycle,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def _ensure_sqlite_schema() -> None:
    if "sqlite" not in _settings.database_url.lower():
        return
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS student_accounts (
                id INTEGER PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(512) NOT NULL,
                role VARCHAR(10) NOT NULL DEFAULT 'STUDENT',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS student_profiles (
                id INTEGER PRIMARY KEY,
                account_id INTEGER UNIQUE,
                client_key VARCHAR(120) NOT NULL,
                name VARCHAR(120) NOT NULL,
                university_id INTEGER NOT NULL,
                curriculum_id INTEGER NOT NULL,
                stream_id INTEGER NOT NULL,
                study_hours_per_day REAL NOT NULL DEFAULT 2.0,
                study_days TEXT NOT NULL DEFAULT '[]',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES student_accounts(id) ON DELETE SET NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY,
                account_id INTEGER NOT NULL,
                code_hash VARCHAR(128) NOT NULL,
                expires_at DATETIME NOT NULL,
                used_at DATETIME,
                attempts INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES student_accounts(id) ON DELETE CASCADE
            )
        """))


_ensure_sqlite_schema()


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
