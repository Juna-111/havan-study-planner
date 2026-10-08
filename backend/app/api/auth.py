from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from slowapi import Limiter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import deps as core_deps
from app.core.config import API_PREFIX, get_settings
from app.core.limiter import (
    auth_forgot_key,
    auth_login_key,
    auth_signup_key,
    limiter,
)
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
_settings = get_settings()


def current_account(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(core_deps.bearer)],
    db: Session = Depends(get_db),
) -> StudentAccount:
    return core_deps.current_account(request, credentials, db)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute", key_func=auth_signup_key)
def signup(request: Request, payload: AuthSignup = Body(...), db: Session = Depends(get_db)):
    account, token = signup_account(db, payload.email, payload.password)
    return AuthResponse(access_token=token, account=account_read(db, account))


@router.post("/login", response_model=AuthResponse)
@limiter.limit("15/minute", key_func=auth_login_key)
def login(request: Request, payload: AuthLogin = Body(...), db: Session = Depends(get_db)):
    account, token = login_account(db, payload.email, payload.password)
    return AuthResponse(access_token=token, account=account_read(db, account))


@router.post("/session", dependencies=[Depends(current_account)])
@limiter.limit("15/minute", key_func=auth_login_key)
async def login_session(
    request: Request,
    payload: AuthLogin = Body(...),
    response: Response = None,
    db: Session = Depends(get_db),
):
    if response is None:
        response = Response()
    account, token = login_account(db, payload.email, payload.password)
    is_dev = _settings.environment.strip().lower() == "development"
    max_age = _settings.auth_token_ttl_days * 86400
    cookie_attrs = f"httponly; samesite=lax; path={API_PREFIX}; max-age={max_age}"
    if not is_dev:
        cookie_attrs += "; secure"
    response.headers.append(
        "Set-Cookie",
        f"havan_session={token}; {cookie_attrs}",
    )
    return {
        "token_type": "cookie",
        "account": account_read(db, account).model_dump(),
    }


@router.post("/logout")
async def logout(response: Response, _: StudentAccount = Depends(current_account)):
    response.headers.append(
        "Set-Cookie",
        f"havan_session=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; httponly; samesite=lax; path={API_PREFIX}",
    )
    return {"message": "Logged out."}


@router.get("/me", response_model=AuthAccountRead)
def me(account: StudentAccount = Depends(current_account), db: Session = Depends(get_db)):
    return account_read(db, account)


@router.post("/change-password", response_model=AuthAccountRead)
@limiter.limit("5/minute", key_func=auth_login_key)
def change_password(
    request: Request,
    payload: PasswordChange = Body(...),
    account: StudentAccount = Depends(current_account),
    db: Session = Depends(get_db),
):
    from app.core.security import verify_password
    if not verify_password(payload.current_password, account.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    account.password_hash = hash_password(payload.new_password)
    db.commit()
    return account_read(db, account)


@router.post("/forgot-password")
@limiter.limit("3/15minute", key_func=auth_forgot_key)
def forgot_password(request: Request, payload: ForgotPasswordRequest = Body(...), db: Session = Depends(get_db)):
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
@limiter.limit("10/minute", key_func=auth_forgot_key)
def verify_reset_code(request: Request, payload: VerifyResetCodeRequest = Body(...), db: Session = Depends(get_db)):
    verify_reset_token(db, payload.email, payload.code)
    return {"message": "Verification code accepted."}


@router.post("/reset-password")
@limiter.limit("5/minute", key_func=auth_forgot_key)
def reset_password_route(request: Request, payload: ResetPasswordRequest = Body(...), db: Session = Depends(get_db)):
    reset_password(db, payload.email, payload.code, payload.new_password)
    return {"message": "Password reset successfully. You can now sign in."}
