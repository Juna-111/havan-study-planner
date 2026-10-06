from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from app.core.config import get_settings


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    rounds = 240_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)
    return "pbkdf2_sha256$$" + str(rounds) + "$$" + base64.urlsafe_b64encode(salt).decode() + "$$" + base64.urlsafe_b64encode(digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt_b64, digest_b64 = stored.split("$$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.urlsafe_b64decode(salt_b64), int(rounds))
        return hmac.compare_digest(digest, base64.urlsafe_b64decode(digest_b64))
    except (ValueError, TypeError):
        return False


def make_access_token(account_id: int) -> str:
    settings = get_settings()
    expires = int((datetime.now(timezone.utc) + timedelta(days=settings.auth_token_ttl_days)).timestamp())
    payload = f"{account_id}:{expires}"
    signature = hmac.new(settings.auth_secret.encode(), payload.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(f"{payload}:{base64.urlsafe_b64encode(signature).decode()}".encode()).decode()


def decode_access_token(token: str) -> tuple[int, int]:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        account_id_s, expires_s, signature = raw.split(":", 2)
        payload = f"{account_id_s}:{expires_s}"
        expected = hmac.new(get_settings().auth_secret.encode(), payload.encode(), hashlib.sha256).digest()
        provided = base64.urlsafe_b64decode(signature.encode())
        if not hmac.compare_digest(expected, provided):
            raise ValueError
        expires = int(expires_s)
        if expires < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError
        return int(account_id_s), expires
    except (ValueError, TypeError, UnicodeDecodeError):
        raise ValueError("invalid access token") from None


def reset_code_hash(code: str) -> str:
    return hmac.new(get_settings().auth_secret.encode(), code.encode(), hashlib.sha256).hexdigest()
