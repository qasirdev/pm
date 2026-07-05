import os
import secrets
from pathlib import Path

from fastapi import Cookie, HTTPException
from itsdangerous import BadSignature, URLSafeTimedSerializer

SESSION_COOKIE_NAME = "session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7  # 1 week

HARDCODED_USERNAME = "user"
HARDCODED_PASSWORD = "password"

_SECRET_KEY_FILE = Path(__file__).parent.parent / ".session_secret"


def _load_or_create_secret_key() -> str:
    env_secret = os.environ.get("SESSION_SECRET_KEY")
    if env_secret:
        return env_secret
    if _SECRET_KEY_FILE.exists():
        return _SECRET_KEY_FILE.read_text().strip()
    key = secrets.token_hex(32)
    _SECRET_KEY_FILE.write_text(key)
    return key


_serializer = URLSafeTimedSerializer(_load_or_create_secret_key())


def verify_credentials(username: str, password: str) -> bool:
    return username == HARDCODED_USERNAME and password == HARDCODED_PASSWORD


def create_session_token(username: str) -> str:
    return _serializer.dumps({"username": username})


def read_session_username(token: str) -> str | None:
    try:
        data = _serializer.loads(token, max_age=SESSION_MAX_AGE_SECONDS)
    except BadSignature:
        return None
    return data.get("username")


def require_session(session: str | None = Cookie(default=None)) -> str:
    username = read_session_username(session) if session else None
    if username is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return username
