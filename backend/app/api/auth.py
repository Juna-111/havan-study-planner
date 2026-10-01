from __future__ import annotations

import base64, hashlib, hmac, secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.models.student import StudentAccount, StudentProfile
from app.db.session import get_db
from app.schemas.student import AuthAccountRead, AuthLogin, AuthResponse, AuthSignup, PasswordChange

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
DB = Annotated[Session, Depends(get_db)]
bearer = HTTPBearer(auto_error=False)

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