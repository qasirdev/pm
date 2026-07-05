from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_serves_kanban_board():
    response = client.get("/")
    assert response.status_code == 200
    assert "Kanban Studio" in response.text
    assert "Backlog" in response.text


def test_root_does_not_serve_placeholder():
    response = client.get("/")
    assert "scaffolding placeholder" not in response.text
