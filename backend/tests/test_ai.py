import os

import pytest
from fastapi.testclient import TestClient

from app.main import app

requires_openrouter_key = pytest.mark.skipif(
    not os.environ.get("OPENROUTER_API_KEY"),
    reason="requires a live OPENROUTER_API_KEY and network access",
)


@pytest.fixture
def client():
    with TestClient(app) as c:
        c.post("/api/login", json={"username": "user", "password": "password"})
        yield c


@requires_openrouter_key
def test_ai_ping_answers_2_plus_2(client):
    response = client.get("/api/ai/ping")
    assert response.status_code == 200
    assert "4" in response.json()["response"]


def test_ai_ping_requires_auth():
    with TestClient(app) as unauth_client:
        response = unauth_client.get("/api/ai/ping")
    assert response.status_code == 401
