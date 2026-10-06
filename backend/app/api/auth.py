from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import API_PREFIX
from app.core.deps import current_account
from app.core.security import hash_password
from app.db.models.student import PasswordResetToken, StudentAccount
from app.db.session import get_db
from app.schemas.student import (
    AuthAccountRead, AuthLogin, AuthResponse, AuthSignup, ForgotPasswordRequest,
    PasswordChange, ResetPasswordRequest, VerifyResetCodeRequest,
)
from app.services.auth_service import (
    account_read, create_reset_token, login as login_account, reset_password,
    send_reset_email, signup as signup_account, verify_reset_token,
)

router = APIRouter(prefix=f"{API_PREFIX}/auth", tags=["authentication"])
DB = Annotated[Session, Depends(get_db)]


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: AuthSignup, db: DB):
    account, token = signup_account(db, payload.email, payload.password)
    return AuthResponse(access_token=token, account=account_read(db, account))


@router.post("/login", response_model=AuthResponse)
def login(payload: AuthLogin, db: DB):
    account, token = login_account(db, payload.email, payload.password)
    return AuthResponse(access_token=token, account=account_read(db, account))


@router.get("/me", response_model=AuthAccountRead)
def me(account: Annotated[StudentAccount, Depends(current_account)], db: DB):
    return account_read(db, account)


@router.post("/change-password", response_model=AuthAccountRead)
def change_password(
    payload: PasswordChange,
    account: Annotated[StudentAccount, Depends(current_account)],
    db: DB,
):
    from app.core.security import verify_password
    if not verify_password(payload.current_password, account.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    account.password_hash = hash_password(payload.new_password)
    db.commit()
    return account_read(db, account)


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: DB):
    email = payload.email.strip().lower()
    account = db.scalar(select(StudentAccount).where(StudentAccount.email == email))
    if account is None:
        return {"message": "If an account exists for this email, a verification code has been sent."}
    code = create_reset_token(db, account)
    try:
        send_reset_email(email, code)
    except HTTPException:
        token = db.scalar(select(PasswordResetToken).where(
            PasswordResetToken.account_id == account.id,
            PasswordResetToken.used_at.is_(None),
        ).order_by(PasswordResetToken.created_at.desc()))
        if token:
            db.delete(token)
            db.commit()
        raise
    return {"message": "If an account exists for this email, a verification code has been sent."}


@router.post("/verify-reset-code")
def verify_reset_code(payload: VerifyResetCodeRequest, db: DB):
    verify_reset_token(db, payload.email, payload.code)
    return {"message": "Verification code accepted."}


@router.post("/reset-password")
def reset_password_route(payload: ResetPasswordRequest, db: DB):
    reset_password(db, payload.email, payload.code, payload.new_password)
    return {"message": "Password reset successfully. You can now sign in."}
