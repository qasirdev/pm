import hashlib
import hmac
import os
import secrets
from pathlib import Path

from fastapi import Cookie, HTTPException
from itsdangerous import BadSignature, URLSafeTimedSerializer

SESSION_COOKIE_NAME = "session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7  # 1 week

# Off by default for local http development; set COOKIE_SECURE=1 when
# deploying behind HTTPS so the session cookie is never sent over plain http.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE") == "1"

HARDCODED_USERNAME = "user"
HARDCODED_PASSWORD = "password"

# Fixed salt is acceptable here: there is exactly one hardcoded account, so
# there is no cross-user rainbow-table concern. This hash exists to avoid
# storing/comparing the password in plain text, not to defend a real
# multi-user credential store (see docs/database.md).
_PASSWORD_SALT = b"pm-mvp-fixed-salt"
_PBKDF2_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), _PASSWORD_SALT, _PBKDF2_ITERATIONS
    )
    return digest.hex()


HARDCODED_PASSWORD_HASH = hash_password(HARDCODED_PASSWORD)

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
    username_matches = hmac.compare_digest(username, HARDCODED_USERNAME)
    password_matches = hmac.compare_digest(hash_password(password), HARDCODED_PASSWORD_HASH)
    return username_matches and password_matches


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
