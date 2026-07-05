import os

import pytest
from fastapi.testclient import TestClient

from app.board import get_board_id_for_user
from app.chat import _apply_action
from app.db import get_connection
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


def test_chat_requires_auth():
    with TestClient(app) as unauth_client:
        response = unauth_client.post(
            "/api/chat", json={"message": "hello", "history": []}
        )
    assert response.status_code == 401


@pytest.mark.live
@requires_openrouter_key
def test_chat_without_board_intent_leaves_board_unchanged(client):
    board_before = client.get("/api/board").json()

    response = client.post(
        "/api/chat",
        json={"message": "Hello, what can you help me with?", "history": []},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["reply"]
    assert body["board"] == board_before


@pytest.mark.live
@requires_openrouter_key
def test_chat_creates_and_moves_a_card(client):
    board = client.get("/api/board").json()
    backlog_id = board["columns"][0]["id"]
    done_id = board["columns"][4]["id"]

    create_response = client.post(
        "/api/chat",
        json={
            "message": "Add a card called 'Buy milk' to the Backlog column.",
            "history": [],
        },
    )
    created_board = create_response.json()["board"]
    assert len(created_board["columns"][0]["cardIds"]) == 1
    card_id = created_board["columns"][0]["cardIds"][0]
    assert created_board["cards"][card_id]["title"] == "Buy milk"

    move_response = client.post(
        "/api/chat",
        json={"message": "Move the Buy milk card to Done.", "history": []},
    )
    moved_board = move_response.json()["board"]
    assert card_id in moved_board["columns"][4]["cardIds"]
    assert card_id not in moved_board["columns"][0]["cardIds"]

    assert backlog_id != done_id


def test_apply_action_raises_for_unknown_card_id(tmp_path, monkeypatch):
    from app.board import CardNotFoundError
    from app import db as db_module

    monkeypatch.setattr(db_module, "DB_PATH", tmp_path / "test.db")
    db_module.init_db()

    conn = get_connection()
    try:
        get_board_id_for_user(conn, "user")

        with pytest.raises(CardNotFoundError):
            _apply_action(
                conn,
                {
                    "type": "move_card",
                    "card_id": "card-9999",
                    "column_id": "col-1",
                    "title": None,
                    "details": None,
                },
            )
    finally:
        conn.close()


def make_fake_client(content):
    fake_completion = type(
        "FakeCompletion",
        (),
        {
            "choices": [
                type(
                    "FakeChoice",
                    (),
                    {"message": type("FakeMessage", (), {"content": content})()},
                )()
            ]
        },
    )()

    class FakeCompletions:
        def create(self, **kwargs):
            return fake_completion

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        chat = FakeChat()

    return FakeClient()


def test_chat_route_ignores_action_with_unknown_card_id(client, monkeypatch):
    from app import chat as chat_module

    fake_client = make_fake_client(
        '{"reply": "done", "actions": '
        '[{"type": "move_card", "card_id": "card-9999", '
        '"column_id": "col-1", "title": null, "details": null}]}'
    )
    monkeypatch.setattr(chat_module, "get_client", lambda: fake_client)

    board_before = client.get("/api/board").json()
    response = client.post("/api/chat", json={"message": "move it", "history": []})

    assert response.status_code == 200
    assert "done" in response.json()["reply"]
    assert "1 requested action could not be applied" in response.json()["reply"]
    assert response.json()["board"] == board_before


def test_chat_handles_empty_ai_response_gracefully(client, monkeypatch):
    from app import chat as chat_module

    fake_client = make_fake_client(None)
    monkeypatch.setattr(chat_module, "get_client", lambda: fake_client)

    board_before = client.get("/api/board").json()
    response = client.post("/api/chat", json={"message": "hello", "history": []})

    assert response.status_code == 200
    body = response.json()
    assert body["reply"]
    assert body["board"] == board_before


def test_chat_handles_malformed_json_response_gracefully(client, monkeypatch):
    from app import chat as chat_module

    fake_client = make_fake_client("not valid json {{{")
    monkeypatch.setattr(chat_module, "get_client", lambda: fake_client)

    board_before = client.get("/api/board").json()
    response = client.post("/api/chat", json={"message": "hello", "history": []})

    assert response.status_code == 200
    body = response.json()
    assert body["reply"]
    assert body["board"] == board_before


def test_chat_handles_openrouter_error_gracefully(client, monkeypatch):
    from app import chat as chat_module
    from openai import APIConnectionError

    class FailingCompletions:
        def create(self, **kwargs):
            raise APIConnectionError(request=None)

    class FailingChat:
        completions = FailingCompletions()

    class FailingClient:
        chat = FailingChat()

    monkeypatch.setattr(chat_module, "get_client", lambda: FailingClient())

    board_before = client.get("/api/board").json()
    response = client.post("/api/chat", json={"message": "hello", "history": []})

    assert response.status_code == 200
    body = response.json()
    assert body["reply"]
    assert body["board"] == board_before


def client_board_snapshot(conn, board_id):
    from app.board import load_board

    return load_board(conn, board_id).model_dump()
