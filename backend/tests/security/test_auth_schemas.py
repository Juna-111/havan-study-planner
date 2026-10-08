from types import SimpleNamespace
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from app.schemas.student import AuthLogin, AuthSignup
from app.services.auth_service import login as login_account


class FakeDB:
    def __init__(self, account):
        self._account = account

    def scalar(self, _statement):
        return self._account

    def commit(self):
        pass

    def refresh(self, _item):
        pass


class FakeAccount:
    def __init__(self, role="STUDENT", email="test@example.com"):
        self.id = 42
        self.email = email
        self.password_hash = "valid_hash"
        self.role = role


def test_login_password_minimum_8_chars():
    with pytest.raises(ValidationError) as exc:
        AuthLogin(email="valid@example.com", password="short")
    errors = [e["type"] for e in exc.value.errors()]
    assert "string_too_short" in errors


def test_signup_rejects_invalid_email_format():
    with pytest.raises(ValidationError):
        AuthSignup(email="not-an-email", password="ValidPass123")

    with pytest.raises(ValidationError):
        AuthSignup(email="@nodomain.com", password="ValidPass123")


def test_admin_role_sticky_after_env_change():
    account = FakeAccount(role="ADMIN", email="admin@example.com")
    db = FakeDB(account)

    with patch("app.services.auth_service.verify_password", return_value=True):
        with patch("app.services.auth_service.is_admin_email", return_value=False):
            result_account, _ = login_account(db, "admin@example.com", "ValidPass123")
            assert result_account.role == "ADMIN", "ADMIN role must never be demoted"


def test_student_promoted_to_admin_when_matches_env():
    account = FakeAccount(role="STUDENT", email="newadmin@example.com")
    db = FakeDB(account)

    with patch("app.services.auth_service.verify_password", return_value=True):
        with patch("app.services.auth_service.is_admin_email", return_value=True):
            result_account, _ = login_account(db, "newadmin@example.com", "ValidPass123")
            assert result_account.role == "ADMIN"


def test_signup_email_normalizes_to_lower():
    s = AuthSignup(email="MiXeD@ExAmPlE.COM", password="ValidPass123")
    assert s.email == "mixed@example.com"


def test_login_email_normalizes_to_lower():
    l = AuthLogin(email="UPPER@EXAMPLE.COM", password="ValidPass123")
    assert l.email == "upper@example.com"
