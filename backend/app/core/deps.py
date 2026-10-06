from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import DomainError
from app.core.security import decode_access_token
from app.db.models.student import StudentAccount, StudentProfile
from app.db.session import get_db

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]


def current_account(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: DB,
) -> StudentAccount:
    if credentials is None:
        raise DomainError("UNAUTHORIZED", "Authentication required.", 401)
    try:
        account_id, _ = decode_access_token(credentials.credentials)
    except ValueError:
        raise DomainError("UNAUTHORIZED", "Your session is invalid or expired. Please sign in again.", 401) from None
    account = db.get(StudentAccount, account_id)
    if account is None:
        raise DomainError("UNAUTHORIZED", "Your session is invalid or expired. Please sign in again.", 401)
    return account


def current_student(account: Annotated[StudentAccount, Depends(current_account)], db: DB) -> StudentProfile:
    profile = db.scalar(select(StudentProfile).where(StudentProfile.account_id == account.id))
    if profile is None:
        raise DomainError("ONBOARDING_REQUIRED", "Complete your student profile first.", 409)
    return profile


def require_admin(account: Annotated[StudentAccount, Depends(current_account)]) -> StudentAccount:
    if account.role != "ADMIN":
        raise DomainError("FORBIDDEN", "Administrator access required.", 403)
    return account


def require_student_owner(
    student_id: int,
    account: Annotated[StudentAccount, Depends(current_account)],
    db: DB,
) -> StudentProfile:
    profile = db.get(StudentProfile, student_id)
    if profile is None or profile.account_id != account.id:
        raise DomainError("FORBIDDEN", "You cannot access another student's data.", 403)
    return profile
