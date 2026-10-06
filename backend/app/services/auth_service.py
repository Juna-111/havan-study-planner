from __future__ import annotations

import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import DomainError
from app.core.security import hash_password, login_throttle, make_access_token, reset_code_hash, verify_password
from app.db.models.student import PasswordResetToken, StudentAccount, StudentProfile
from app.schemas.student import AuthAccountRead


def is_admin_email(email: str) -> bool:
    return email.strip().lower() in {item.strip().lower() for item in get_settings().admin_emails if item.strip()}


def account_read(db: Session, account: StudentAccount) -> AuthAccountRead:
    profile = db.scalar(select(StudentProfile).where(StudentProfile.account_id == account.id))
    return AuthAccountRead(id=account.id, email=account.email, role=account.role, student_profile_id=profile.id if profile else None)


def signup(db: Session, email: str, password: str) -> tuple[StudentAccount, str]:
    normalized = email.strip().lower()
    if db.scalar(select(StudentAccount).where(StudentAccount.email == normalized)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    account = StudentAccount(email=normalized, password_hash=hash_password(password), role="ADMIN" if is_admin_email(normalized) else "STUDENT")
    db.add(account)
    db.commit()
    db.refresh(account)
    return account, make_access_token(account.id)


def login(db: Session, email: str, password: str) -> tuple[StudentAccount, str]:
    normalized = email.strip().lower()
    if not login_throttle.allowed(normalized):
        raise DomainError("TOO_MANY_ATTEMPTS", "Too many failed sign-in attempts. Please try again later.", 429)
    account = db.scalar(select(StudentAccount).where(StudentAccount.email == normalized))
    if account is None or not verify_password(password, account.password_hash):
        login_throttle.record_failure(normalized)
        raise DomainError("UNAUTHORIZED", "Email or password is incorrect.", 401)
    login_throttle.clear(normalized)
    desired_role = "ADMIN" if is_admin_email(account.email) else "STUDENT"
    if account.role != desired_role:
        account.role = desired_role
        db.commit()
        db.refresh(account)
    return account, make_access_token(account.id)


def send_reset_email(email: str, code: str) -> None:
    settings = get_settings()
    if not settings.smtp_user or not settings.smtp_password:
        raise HTTPException(status_code=503, detail="Password recovery email is not configured yet.")
    message = EmailMessage()
    message["Subject"] = "Havan Study Planner password reset code"
    message["From"] = settings.smtp_from or settings.smtp_user
    message["To"] = email
    message.set_content(
        "Your Havan Study Planner verification code is: " + code + "\n\n"
        + "This code expires in " + str(settings.password_reset_ttl_minutes) + " minutes."
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise HTTPException(status_code=503, detail="We could not send the verification email. Please try again later.") from exc


def create_reset_token(db: Session, account: StudentAccount) -> str:
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.account_id == account.id, PasswordResetToken.used_at.is_(None)))
    code = f"{__import__('secrets').randbelow(1_000_000):06d}"
    db.add(PasswordResetToken(
        account_id=account.id,
        code_hash=reset_code_hash(code),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=get_settings().password_reset_ttl_minutes),
    ))
    db.commit()
    return code


def verify_reset_token(db: Session, email: str, code: str) -> PasswordResetToken:
    account = db.scalar(select(StudentAccount).where(StudentAccount.email == email.strip().lower()))
    if account is None:
        raise HTTPException(status_code=400, detail="The verification code is invalid or expired.")
    token = db.scalar(select(PasswordResetToken).where(
        PasswordResetToken.account_id == account.id,
        PasswordResetToken.used_at.is_(None),
    ).order_by(PasswordResetToken.created_at.desc()))
    now = datetime.now(timezone.utc)
    if token is None or token.expires_at < now or token.attempts >= 5:
        raise HTTPException(status_code=400, detail="The verification code is invalid or expired.")
    if not __import__("hmac").compare_digest(token.code_hash, reset_code_hash(code)):
        token.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="The verification code is invalid or expired.")
    return token


def reset_password(db: Session, email: str, code: str, new_password: str) -> None:
    token = verify_reset_token(db, email, code)
    account = db.get(StudentAccount, token.account_id)
    account.password_hash = hash_password(new_password)
    token.used_at = datetime.now(timezone.utc)
    db.commit()
