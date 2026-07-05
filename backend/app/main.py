import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from openai import OpenAIError
from pydantic import BaseModel

from app.ai import get_client, get_model
from app.auth import (
    COOKIE_SECURE,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    create_session_token,
    require_session,
    verify_credentials,
)
from app.board import router as board_router
from app.chat import router as chat_router
from app.db import init_db, reset_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


# No CORS middleware is configured, and none should be added: the frontend is
# served as static files from this same FastAPI app, so every /api/* call is
# same-origin. Adding permissive CORS here would let other origins ride the
# session cookie's credentials, which is a CSRF risk this design avoids by
# construction.
app = FastAPI(title="Project Management MVP", lifespan=lifespan)

STATIC_DIR = Path(__file__).parent / "static"


class LoginRequest(BaseModel):
    username: str
    password: str


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: LoginRequest, response: Response) -> dict[str, str]:
    if not verify_credentials(credentials.username, credentials.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_session_token(credentials.username)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return {"ok": True}


@app.get("/api/session")
def session_status(username: str = Depends(require_session)) -> dict[str, str]:
    return {"username": username}


@app.get("/api/ai/ping", dependencies=[Depends(require_session)])
def ai_ping() -> dict[str, str]:
    client = get_client()
    try:
        response = client.chat.completions.create(
            model=get_model(),
            messages=[
                {"role": "user", "content": "What is 2+2? Reply with just the number."}
            ],
        )
    except OpenAIError as error:
        raise HTTPException(
            status_code=502, detail=f"OpenRouter request failed: {error}"
        ) from error
    return {"response": response.choices[0].message.content or ""}


if os.environ.get("ENABLE_TEST_RESET") == "1":

    @app.post("/api/test/reset")
    def test_reset() -> dict[str, bool]:
        reset_db()
        return {"ok": True}


app.include_router(board_router)
app.include_router(chat_router)

app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
