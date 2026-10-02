from __future__ import annotations

import base64, hashlib, hmac, secrets, smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.models.student import PasswordResetToken, StudentAccount, StudentProfile
from app.db.session import get_db
from app.schemas.student import AuthAccountRead, AuthLogin, AuthResponse, AuthSignup, ForgotPasswordRequest, PasswordChange, ResetPasswordRequest, VerifyResetCodeRequest

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
DB = Annotated[Session, Depends(get_db)]
bearer = HTTPBearer(auto_error=False)


def _reset_code_hash(code: str) -> str:
    secret = get_settings().auth_secret.encode()
    return hmac.new(secret, code.encode(), hashlib.sha256).hexdigest()


def _ensure_reset_table(db: Session) -> None:
    PasswordResetToken.__table__.create(bind=db.get_bind(), checkfirst=True)


def _send_reset_email(email: str, code: str) -> None:
    settings = get_settings()
    if not settings.smtp_user or not settings.smtp_password:
        raise HTTPException(status_code=503, detail='Password recovery email is not configured yet.')

    message = EmailMessage()
    message['Subject'] = 'Havan Study Planner password reset code'
    message['From'] = settings.smtp_from or settings.smtp_user
    message['To'] = email
    message.set_content(
        'Your Havan Study Planner verification code is: ' + code + '\n\n'
        'This code expires in ' + str(settings.password_reset_ttl_minutes) + ' minutes. '
        'If you did not request a password reset, you can ignore this email.'
    )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise HTTPException(status_code=503, detail='We could not send the verification email. Please try again later.') from exc

def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16); rounds = 240_000
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, rounds)
    return 'pbkdf2_sha256$$' + str(rounds) + '$$' + base64.urlsafe_b64encode(salt).decode() + '$$' + base64.urlsafe_b64encode(digest).decode()

def _verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt_b64, digest_b64 = stored.split('$$')
        if algorithm != 'pbkdf2_sha256': return False
        digest = hashlib.pbkdf2_hmac('sha256', password.encode(), base64.urlsafe_b64decode(salt_b64), int(rounds))
        return hmac.compare_digest(digest, base64.urlsafe_b64decode(digest_b64))
    except (ValueError, TypeError): return False

def _make_token(account_id: int) -> str:
    expires = int((datetime.now(timezone.utc) + timedelta(days=get_settings().auth_token_ttl_days)).timestamp())
    payload = str(account_id) + ':' + str(expires)
    signature = hmac.new(get_settings().auth_secret.encode(), payload.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode((payload + ':' + base64.urlsafe_b64encode(signature).decode()).encode()).decode()

def _account_from_token(token: str, db: Session) -> StudentAccount:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode(); account_id_s, expires_s, signature = raw.split(':', 2)
        payload = account_id_s + ':' + expires_s
        expected = hmac.new(get_settings().auth_secret.encode(), payload.encode(), hashlib.sha256).digest()
        provided = base64.urlsafe_b64decode(signature.encode())
        if not hmac.compare_digest(expected, provided) or int(expires_s) < int(datetime.now(timezone.utc).timestamp()): raise ValueError
        account = db.get(StudentAccount, int(account_id_s))
    except (ValueError, TypeError, UnicodeDecodeError): account = None
    if account is None: raise HTTPException(status_code=401, detail='Your session is invalid or expired. Please sign in again.')
    return account

def current_account(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)], db: DB) -> StudentAccount:
    if credentials is None: raise HTTPException(status_code=401, detail='Authentication required.')
    return _account_from_token(credentials.credentials, db)

def account_read(db: Session, account: StudentAccount) -> AuthAccountRead:
    profile = db.scalar(select(StudentProfile).where(StudentProfile.account_id == account.id))
    return AuthAccountRead(id=account.id, email=account.email, student_profile_id=profile.id if profile else None)

@router.post('/signup', response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: AuthSignup, db: DB):
    email = payload.email.strip().lower()
    if db.scalar(select(StudentAccount).where(StudentAccount.email == email)): raise HTTPException(status_code=409, detail='An account with this email already exists.')
    account = StudentAccount(email=email, password_hash=_hash_password(payload.password)); db.add(account); db.commit(); db.refresh(account)
    return AuthResponse(access_token=_make_token(account.id), account=account_read(db, account))

@router.post('/login', response_model=AuthResponse)
def login(payload: AuthLogin, db: DB):
    account = db.scalar(select(StudentAccount).where(StudentAccount.email == payload.email.strip().lower()))
    if account is None or not _verify_password(payload.password, account.password_hash): raise HTTPException(status_code=401, detail='Email or password is incorrect.')
    return AuthResponse(access_token=_make_token(account.id), account=account_read(db, account))

@router.get('/me', response_model=AuthAccountRead)
def me(account: Annotated[StudentAccount, Depends(current_account)], db: DB): return account_read(db, account)

@router.post('/change-password', response_model=AuthAccountRead)
def change_password(payload: PasswordChange, account: Annotated[StudentAccount, Depends(current_account)], db: DB):
    if not _verify_password(payload.current_password, account.password_hash): raise HTTPException(status_code=400, detail='Current password is incorrect.')
    account.password_hash = _hash_password(payload.new_password); db.commit()
    return account_read(db, account)

@router.post('/forgot-password')
def forgot_password(payload: ForgotPasswordRequest, db: DB):
    _ensure_reset_table(db)
    email = payload.email.strip().lower()
    account = db.scalar(select(StudentAccount).where(StudentAccount.email == email))
    if account is None:
        return {'message': 'If an account exists for this email, a verification code has been sent.'}

    db.execute(delete(PasswordResetToken).where(
        PasswordResetToken.account_id == account.id,
        PasswordResetToken.used_at.is_(None),
    ))
    code = f'{secrets.randbelow(1_000_000):06d}'
    token = PasswordResetToken(
        account_id=account.id,
        code_hash=_reset_code_hash(code),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=get_settings().password_reset_ttl_minutes),
    )
    db.add(token)
    db.commit()
    try:
        _send_reset_email(email, code)
    except HTTPException:
        db.delete(token)
        db.commit()
        raise
    return {'message': 'If an account exists for this email, a verification code has been sent.'}


def _get_reset_token(email: str, code: str, db: Session) -> PasswordResetToken:
    account = db.scalar(select(StudentAccount).where(StudentAccount.email == email.strip().lower()))
    if account is None:
        raise HTTPException(status_code=400, detail='The verification code is invalid or expired.')
    token = db.scalar(select(PasswordResetToken).where(
        PasswordResetToken.account_id == account.id,
        PasswordResetToken.used_at.is_(None),
    ).order_by(PasswordResetToken.created_at.desc()))
    now = datetime.now(timezone.utc)
    if token is None or token.expires_at < now or token.attempts >= 5:
        raise HTTPException(status_code=400, detail='The verification code is invalid or expired.')
    if not hmac.compare_digest(token.code_hash, _reset_code_hash(code)):
        token.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail='The verification code is invalid or expired.')
    return token


@router.post('/verify-reset-code')
def verify_reset_code(payload: VerifyResetCodeRequest, db: DB):
    _ensure_reset_table(db)
    _get_reset_token(payload.email, payload.code, db)
    return {'message': 'Verification code accepted.'}


@router.post('/reset-password')
def reset_password(payload: ResetPasswordRequest, db: DB):
    _ensure_reset_table(db)
    token = _get_reset_token(payload.email, payload.code, db)
    account = db.get(StudentAccount, token.account_id)
    account.password_hash = _hash_password(payload.new_password)
    token.used_at = datetime.now(timezone.utc)
    db.commit()
    return {'message': 'Password reset successfully. You can now sign in.'}
