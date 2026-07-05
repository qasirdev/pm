import sqlite3
from pathlib import Path

from app.auth import HARDCODED_PASSWORD, HARDCODED_USERNAME

DB_PATH = Path(__file__).parent.parent / "data" / "app.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id),
    title TEXT NOT NULL,
    position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    column_id INTEGER NOT NULL REFERENCES columns(id),
    title TEXT NOT NULL,
    details TEXT,
    position INTEGER NOT NULL
);
"""

DEFAULT_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        _seed_user_and_board(conn)
        conn.commit()
    finally:
        conn.close()


def reset_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(
            "DELETE FROM cards; DELETE FROM columns; DELETE FROM boards; DELETE FROM users;"
        )
        _seed_user_and_board(conn)
        conn.commit()
    finally:
        conn.close()


def _seed_user_and_board(conn: sqlite3.Connection) -> None:
    user = conn.execute(
        "SELECT id FROM users WHERE username = ?", (HARDCODED_USERNAME,)
    ).fetchone()
    if user is None:
        cursor = conn.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (HARDCODED_USERNAME, HARDCODED_PASSWORD),
        )
        user_id = cursor.lastrowid
    else:
        user_id = user["id"]

    board = conn.execute(
        "SELECT id FROM boards WHERE user_id = ?", (user_id,)
    ).fetchone()
    if board is None:
        cursor = conn.execute(
            "INSERT INTO boards (user_id) VALUES (?)", (user_id,)
        )
        board_id = cursor.lastrowid
        for position, title in enumerate(DEFAULT_COLUMNS):
            conn.execute(
                "INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)",
                (board_id, title, position),
            )
