from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.student import StudentAccount, StudentProfile
from app.db.session import get_db
from app.core.security import decode_access_token

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]
CurrentAccount = Annotated[StudentAccount, Depends(lambda: None)]


def current_account(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: DB,
) -> StudentAccount:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        account_id, _ = decode_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Please sign in again.") from None
    account = db.get(StudentAccount, account_id)
    if account is None:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Please sign in again.")
    return account


def current_student(account: Annotated[StudentAccount, Depends(current_account)], db: DB) -> StudentProfile:
    profile = db.scalar(select(StudentProfile).where(StudentProfile.account_id == account.id))
    if profile is None:
        raise HTTPException(status_code=409, detail={"code": "ONBOARDING_REQUIRED", "message": "Complete your student profile first."})
    return profile


def require_admin(account: Annotated[StudentAccount, Depends(current_account)]) -> StudentAccount:
    if account.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return account


def require_student_owner(student_id: int, account: Annotated[StudentAccount, Depends(current_account)], db: DB) -> StudentProfile:
    profile = db.get(StudentProfile, student_id)
    if profile is None or profile.account_id != account.id:
        raise HTTPException(status_code=403, detail="You cannot access another student's data.")
    return profile
