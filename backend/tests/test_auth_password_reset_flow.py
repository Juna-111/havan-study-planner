from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import time
import json

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import Mock

from app.db.models import *  # noqa: F403 - register complete test metadata
from app.db.models.student import PasswordResetToken
from app.db.session import Base, get_db
from app.main import app
from app.services import auth_service


def test_reset_email_uses_resend_https_api_when_configured(monkeypatch):
    monkeypatch.setattr(
        auth_service,
        "get_settings",
        lambda: SimpleNamespace(
            resend_api_key="re_test_secret",
            email_from="Havan <reset@example.com>",
            smtp_from="",
            smtp_user="",
            smtp_password="",
            password_reset_ttl_minutes=10,
        ),
    )
    captured = {}
    response = Mock(status=200)
    response.__enter__ = Mock(return_value=response)
    response.__exit__ = Mock(return_value=False)

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["authorization"] = request.get_header("Authorization")
        captured["payload"] = json.loads(request.data)
        captured["timeout"] = timeout
        return response

    monkeypatch.setattr(auth_service, "urlopen", fake_urlopen)
    auth_service.send_reset_email("student@example.com", "012345")

    assert captured == {
        "url": "https://api.resend.com/emails",
        "authorization": "Bearer re_test_secret",
        "payload": {
            "from": "Havan <reset@example.com>",
            "to": ["student@example.com"],
            "subject": "Havan Study Planner password reset code",
            "text": "Your Havan Study Planner verification code is: 012345\n\nThis code expires in 10 minutes.",
        },
        "timeout": 10,
    }


class ResponseSendRecorder:
    def __init__(self, application):
        self.application = application
        self.response_sent_at = None

    async def __call__(self, scope, receive, send):
        async def record_send(message):
            if scope["type"] == "http" and message["type"] == "http.response.body" and not message.get("more_body", False):
                self.response_sent_at = time.perf_counter()
            await send(message)

        await self.application(scope, receive, record_send)


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
    response_recorder = ResponseSendRecorder(app)
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
            assert (host, port, timeout) == ("localhost", 1025, 10)

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def starttls(self):
            pass

        def login(self, user, password):
            assert (user, password) == ("mailer@example.com", "test-password")

        def send_message(self, message):
            assert response_recorder.response_sent_at is not None
            sent["to"] = message["To"]
            sent["body"] = message.get_content()
            time.sleep(0.65)

    monkeypatch.setattr(auth_service.smtplib, "SMTP", FakeSMTP)

    try:
        with TestClient(response_recorder) as client:
            signup = client.post(
                "/api/v1/auth/signup",
                    json={"email": "student@example.com", "password": "InitialPass123"},
            )
            assert signup.status_code == 201

            response_recorder.response_sent_at = None
            forgot_started_at = time.perf_counter()
            forgot = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": "student@example.com"},
            )
            assert forgot.status_code == 200
            assert response_recorder.response_sent_at is not None
            assert response_recorder.response_sent_at - forgot_started_at < 0.5
            assert time.perf_counter() - forgot_started_at >= 0.6
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
