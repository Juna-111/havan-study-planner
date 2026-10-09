from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import *  # noqa: F403 - register complete test metadata
from app.db.models.student import PasswordResetToken
from app.db.session import Base, get_db
from app.main import app
from app.services import auth_service


def test_password_reset_dispatches_email_and_resets_password(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def get_test_db():
        with test_session() as db:
            yield db

    app.dependency_overrides[get_db] = get_test_db
    monkeypatch.setattr(
        auth_service,
        "get_settings",
        lambda: SimpleNamespace(
            admin_emails=[],
            smtp_user="mailer@example.com",
            smtp_password="test-password",
            smtp_from="Havan <mailer@example.com>",
            smtp_host="localhost",
            smtp_port=1025,
            password_reset_ttl_minutes=15,
        ),
    )
    sent = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            assert (host, port, timeout) == ("localhost", 1025, 20)

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def starttls(self):
            pass

        def login(self, user, password):
            assert (user, password) == ("mailer@example.com", "test-password")

        def send_message(self, message):
            sent["to"] = message["To"]
            sent["body"] = message.get_content()

    monkeypatch.setattr(auth_service.smtplib, "SMTP", FakeSMTP)

    try:
        with TestClient(app) as client:
            signup = client.post(
                "/api/v1/auth/signup",
                    json={"email": "student@example.com", "password": "InitialPass123"},
            )
            assert signup.status_code == 201

            forgot = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": "student@example.com"},
            )
            assert forgot.status_code == 200
            assert sent["to"] == "student@example.com"
            code = next(part for part in sent["body"].split() if len(part) == 6 and part.isdigit())

            verified = client.post(
                "/api/v1/auth/verify-reset-code",
                json={"email": "student@example.com", "code": code},
            )
            assert verified.status_code == 200

            reset = client.post(
                "/api/v1/auth/reset-password",
                json={"email": "student@example.com", "code": code, "new_password": "Replacement123"},
            )
            assert reset.status_code == 200
            assert client.post(
                "/api/v1/auth/login",
                json={"email": "student@example.com", "password": "Replacement123"},
            ).status_code == 200
            assert client.post(
                "/api/v1/auth/verify-reset-code",
                json={"email": "student@example.com", "code": code},
            ).status_code == 400

            assert client.post(
                "/api/v1/auth/forgot-password",
                json={"email": "student@example.com"},
            ).status_code == 200
            expired_code = next(part for part in sent["body"].split() if len(part) == 6 and part.isdigit())
            with test_session() as db:
                token = db.scalar(select(PasswordResetToken).order_by(PasswordResetToken.id.desc()))
                token.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
                db.commit()
            assert client.post(
                "/api/v1/auth/verify-reset-code",
                json={"email": "student@example.com", "code": expired_code},
            ).status_code == 400
    finally:
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(engine)
        engine.dispose()
