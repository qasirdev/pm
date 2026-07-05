import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        c.post("/api/login", json={"username": "user", "password": "password"})
        yield c


def test_fresh_db_seeds_five_columns(client):
    response = client.get("/api/board")
    assert response.status_code == 200
    body = response.json()
    assert [c["title"] for c in body["columns"]] == [
        "Backlog",
        "Discovery",
        "In Progress",
        "Review",
        "Done",
    ]
    assert body["cards"] == {}


def test_board_requires_auth():
    with TestClient(app) as unauth_client:
        response = unauth_client.get("/api/board")
    assert response.status_code == 401


def test_rename_column(client):
    board = client.get("/api/board").json()
    column_id = board["columns"][0]["id"]

    response = client.patch(f"/api/columns/{column_id}", json={"title": "Renamed"})
    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"

    board_after = client.get("/api/board").json()
    assert board_after["columns"][0]["title"] == "Renamed"


def test_rename_missing_column_404(client):
    response = client.patch("/api/columns/9999", json={"title": "Nope"})
    assert response.status_code == 404


def test_create_card(client):
    board = client.get("/api/board").json()
    column_id = board["columns"][0]["id"]

    response = client.post(
        "/api/cards",
        json={"column_id": column_id, "title": "New card", "details": "Notes"},
    )
    assert response.status_code == 201
    card = response.json()
    assert card["title"] == "New card"

    board_after = client.get("/api/board").json()
    assert board_after["columns"][0]["cardIds"] == [card["id"]]
    assert board_after["cards"][card["id"]]["details"] == "Notes"


def test_create_card_missing_column_404(client):
    response = client.post(
        "/api/cards", json={"column_id": "9999", "title": "x", "details": ""}
    )
    assert response.status_code == 404


def test_move_card_between_columns(client):
    board = client.get("/api/board").json()
    source_id = board["columns"][0]["id"]
    target_id = board["columns"][1]["id"]

    card = client.post(
        "/api/cards", json={"column_id": source_id, "title": "Movable", "details": ""}
    ).json()

    response = client.patch(
        f"/api/cards/{card['id']}", json={"column_id": target_id}
    )
    assert response.status_code == 200

    board_after = client.get("/api/board").json()
    assert board_after["columns"][0]["cardIds"] == []
    assert board_after["columns"][1]["cardIds"] == [card["id"]]


def test_update_missing_card_404(client):
    response = client.patch("/api/cards/9999", json={"title": "x"})
    assert response.status_code == 404


def test_reorder_cards_within_a_column(client):
    board = client.get("/api/board").json()
    column_id = board["columns"][0]["id"]

    card_a = client.post(
        "/api/cards", json={"column_id": column_id, "title": "A", "details": ""}
    ).json()
    card_b = client.post(
        "/api/cards", json={"column_id": column_id, "title": "B", "details": ""}
    ).json()
    card_c = client.post(
        "/api/cards", json={"column_id": column_id, "title": "C", "details": ""}
    ).json()

    board_after_create = client.get("/api/board").json()
    assert board_after_create["columns"][0]["cardIds"] == [
        card_a["id"],
        card_b["id"],
        card_c["id"],
    ]

    # Move C to the front of the column.
    response = client.patch(f"/api/cards/{card_c['id']}", json={"position": 0})
    assert response.status_code == 200

    board_after_reorder = client.get("/api/board").json()
    assert board_after_reorder["columns"][0]["cardIds"] == [
        card_c["id"],
        card_a["id"],
        card_b["id"],
    ]


def test_move_card_to_specific_position_in_another_column(client):
    board = client.get("/api/board").json()
    source_id = board["columns"][0]["id"]
    target_id = board["columns"][1]["id"]

    moving_card = client.post(
        "/api/cards", json={"column_id": source_id, "title": "Moving", "details": ""}
    ).json()
    existing_card = client.post(
        "/api/cards", json={"column_id": target_id, "title": "Existing", "details": ""}
    ).json()

    response = client.patch(
        f"/api/cards/{moving_card['id']}",
        json={"column_id": target_id, "position": 0},
    )
    assert response.status_code == 200

    board_after = client.get("/api/board").json()
    assert board_after["columns"][0]["cardIds"] == []
    assert board_after["columns"][1]["cardIds"] == [
        moving_card["id"],
        existing_card["id"],
    ]


def test_delete_card(client):
    board = client.get("/api/board").json()
    column_id = board["columns"][0]["id"]
    card = client.post(
        "/api/cards", json={"column_id": column_id, "title": "Delete me", "details": ""}
    ).json()

    response = client.delete(f"/api/cards/{card['id']}")
    assert response.status_code == 204

    board_after = client.get("/api/board").json()
    assert board_after["columns"][0]["cardIds"] == []
    assert card["id"] not in board_after["cards"]


def test_delete_missing_card_404(client):
    response = client.delete("/api/cards/9999")
    assert response.status_code == 404
