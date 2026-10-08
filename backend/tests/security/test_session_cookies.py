from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.config import API_PREFIX
from app.main import app

client = TestClient(app)


class FakeAccount:
    def __init__(self):
        self.id = 99
        self.email = "valid@example.com"
        self.password_hash = "hash"
        self.role = "STUDENT"


def _mocked_login_account(_db, _email, _password):
    return FakeAccount(), "test-token-abc123"


def _mocked_get_account(_id):
    return FakeAccount()


def test_session_login_returns_set_cookie_header():
    with patch("app.api.auth.login_account", _mocked_login_account):
        response = client.post(
            f"{API_PREFIX}/auth/session",
            json={"email": "valid@example.com", "password": "ValidPass123"},
        )

    assert "set-cookie" in response.headers
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/api/v1" in set_cookie
    assert "havan_session=test-token-abc123" in set_cookie


def test_me_accepts_cookie_auth_without_header():
    account = FakeAccount()

    def fake_current_account_factory(_request, _credentials, _db):
        return account

    with patch.dict(app.dependency_overrides, {}):
        from app.core import deps
        original = deps.current_account
        deps.current_account = fake_current_account_factory
        try:
            response = client.get(
                f"{API_PREFIX}/auth/me",
                cookies={"havan_session": "test-token-abc123"},
            )
            assert response.status_code == 200
        finally:
            deps.current_account = original
