import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_login_rejects_wrong_credentials(client):
    response = client.post(
        "/api/login", json={"username": "user", "password": "wrong"}
    )
    assert response.status_code == 401
    assert "session" not in response.cookies


def test_login_accepts_correct_credentials_and_sets_cookie(client):
    response = client.post(
        "/api/login", json={"username": "user", "password": "password"}
    )
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert "session" in response.cookies


def test_session_requires_valid_cookie(client):
    response = client.get("/api/session")
    assert response.status_code == 401


def test_session_returns_username_when_logged_in(client):
    client.post("/api/login", json={"username": "user", "password": "password"})

    response = client.get("/api/session")
    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_logout_invalidates_session(client):
    client.post("/api/login", json={"username": "user", "password": "password"})

    logout_response = client.post("/api/logout")
    assert logout_response.status_code == 200

    session_response = client.get("/api/session")
    assert session_response.status_code == 401
