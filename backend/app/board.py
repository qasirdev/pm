import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import HARDCODED_USERNAME, require_session
from app.db import get_connection

router = APIRouter(prefix="/api", dependencies=[Depends(require_session)])

COLUMN_ID_PREFIX = "col-"
CARD_ID_PREFIX = "card-"


def column_id_to_str(raw_id: int) -> str:
    return f"{COLUMN_ID_PREFIX}{raw_id}"


def card_id_to_str(raw_id: int) -> str:
    return f"{CARD_ID_PREFIX}{raw_id}"


def parse_column_id(value: str) -> int:
    if not value.startswith(COLUMN_ID_PREFIX):
        raise ColumnNotFoundError(value)
    try:
        return int(value[len(COLUMN_ID_PREFIX) :])
    except ValueError:
        raise ColumnNotFoundError(value)


def parse_card_id(value: str) -> int:
    if not value.startswith(CARD_ID_PREFIX):
        raise CardNotFoundError(value)
    try:
        return int(value[len(CARD_ID_PREFIX) :])
    except ValueError:
        raise CardNotFoundError(value)


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class RenameColumnRequest(BaseModel):
    title: str


class CreateCardRequest(BaseModel):
    column_id: str
    title: str
    details: str = ""


class UpdateCardRequest(BaseModel):
    title: str | None = None
    details: str | None = None
    column_id: str | None = None
    position: int | None = None


def get_board_id_for_user(conn: sqlite3.Connection, username: str) -> int:
    user = conn.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()
    board = conn.execute(
        "SELECT id FROM boards WHERE user_id = ?", (user["id"],)
    ).fetchone()
    return board["id"]


def load_board(conn: sqlite3.Connection, board_id: int) -> BoardData:
    column_rows = conn.execute(
        "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()

    columns: list[Column] = []
    cards: dict[str, Card] = {}
    for column_row in column_rows:
        card_rows = conn.execute(
            "SELECT id, title, details FROM cards WHERE column_id = ? ORDER BY position",
            (column_row["id"],),
        ).fetchall()
        card_ids: list[str] = []
        for card_row in card_rows:
            card_id = card_id_to_str(card_row["id"])
            card_ids.append(card_id)
            cards[card_id] = Card(
                id=card_id,
                title=card_row["title"],
                details=card_row["details"] or "",
            )
        columns.append(
            Column(
                id=column_id_to_str(column_row["id"]),
                title=column_row["title"],
                cardIds=card_ids,
            )
        )

    return BoardData(columns=columns, cards=cards)


class ColumnNotFoundError(Exception):
    pass


class CardNotFoundError(Exception):
    pass


def rename_column_in_db(conn: sqlite3.Connection, column_id: int, title: str) -> None:
    result = conn.execute(
        "UPDATE columns SET title = ? WHERE id = ?", (title, column_id)
    )
    if result.rowcount == 0:
        raise ColumnNotFoundError(column_id)


def create_card_in_db(
    conn: sqlite3.Connection, column_id: int, title: str, details: str
) -> int:
    column = conn.execute(
        "SELECT id FROM columns WHERE id = ?", (column_id,)
    ).fetchone()
    if column is None:
        raise ColumnNotFoundError(column_id)

    max_position = conn.execute(
        "SELECT COALESCE(MAX(position), -1) AS max_position FROM cards WHERE column_id = ?",
        (column_id,),
    ).fetchone()["max_position"]

    cursor = conn.execute(
        "INSERT INTO cards (column_id, title, details, position) VALUES (?, ?, ?, ?)",
        (column_id, title, details, max_position + 1),
    )
    return cursor.lastrowid


def update_card_in_db(
    conn: sqlite3.Connection,
    card_id: int,
    title: str | None = None,
    details: str | None = None,
    column_id: int | None = None,
    position: int | None = None,
) -> None:
    card = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    if card is None:
        raise CardNotFoundError(card_id)

    if column_id is not None:
        column = conn.execute(
            "SELECT id FROM columns WHERE id = ?", (column_id,)
        ).fetchone()
        if column is None:
            raise ColumnNotFoundError(column_id)

    resolved_title = title if title is not None else card["title"]
    resolved_details = details if details is not None else card["details"]
    resolved_column_id = column_id if column_id is not None else card["column_id"]

    if position is not None:
        resolved_position = position
    elif column_id is not None:
        max_position = conn.execute(
            "SELECT COALESCE(MAX(position), -1) AS max_position FROM cards WHERE column_id = ?",
            (resolved_column_id,),
        ).fetchone()["max_position"]
        resolved_position = max_position + 1
    else:
        resolved_position = card["position"]

    conn.execute(
        "UPDATE cards SET title = ?, details = ?, column_id = ?, position = ? WHERE id = ?",
        (resolved_title, resolved_details, resolved_column_id, resolved_position, card_id),
    )


def delete_card_in_db(conn: sqlite3.Connection, card_id: int) -> None:
    result = conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    if result.rowcount == 0:
        raise CardNotFoundError(card_id)


@router.get("/board")
def get_board() -> BoardData:
    conn = get_connection()
    try:
        board_id = get_board_id_for_user(conn, HARDCODED_USERNAME)
        return load_board(conn, board_id)
    finally:
        conn.close()


@router.patch("/columns/{column_id}")
def rename_column(column_id: str, body: RenameColumnRequest) -> Column:
    conn = get_connection()
    try:
        try:
            raw_column_id = parse_column_id(column_id)
            rename_column_in_db(conn, raw_column_id, body.title)
        except ColumnNotFoundError:
            raise HTTPException(status_code=404, detail="Column not found")
        conn.commit()

        card_rows = conn.execute(
            "SELECT id FROM cards WHERE column_id = ? ORDER BY position",
            (raw_column_id,),
        ).fetchall()
        return Column(
            id=column_id,
            title=body.title,
            cardIds=[card_id_to_str(row["id"]) for row in card_rows],
        )
    finally:
        conn.close()


@router.post("/cards", status_code=201)
def create_card(body: CreateCardRequest) -> Card:
    conn = get_connection()
    try:
        try:
            raw_column_id = parse_column_id(body.column_id)
            raw_card_id = create_card_in_db(
                conn, raw_column_id, body.title, body.details
            )
        except ColumnNotFoundError:
            raise HTTPException(status_code=404, detail="Column not found")
        conn.commit()
        return Card(
            id=card_id_to_str(raw_card_id), title=body.title, details=body.details
        )
    finally:
        conn.close()


@router.patch("/cards/{card_id}")
def update_card(card_id: str, body: UpdateCardRequest) -> Card:
    conn = get_connection()
    try:
        try:
            raw_card_id = parse_card_id(card_id)
            raw_column_id = (
                parse_column_id(body.column_id) if body.column_id is not None else None
            )
            update_card_in_db(
                conn,
                raw_card_id,
                title=body.title,
                details=body.details,
                column_id=raw_column_id,
                position=body.position,
            )
        except CardNotFoundError:
            raise HTTPException(status_code=404, detail="Card not found")
        except ColumnNotFoundError:
            raise HTTPException(status_code=404, detail="Column not found")
        conn.commit()

        card = conn.execute(
            "SELECT * FROM cards WHERE id = ?", (raw_card_id,)
        ).fetchone()
        return Card(id=card_id, title=card["title"], details=card["details"] or "")
    finally:
        conn.close()


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(card_id: str) -> None:
    conn = get_connection()
    try:
        try:
            raw_card_id = parse_card_id(card_id)
            delete_card_in_db(conn, raw_card_id)
        except CardNotFoundError:
            raise HTTPException(status_code=404, detail="Card not found")
        conn.commit()
    finally:
        conn.close()
