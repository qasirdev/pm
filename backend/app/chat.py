import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.ai import get_client, get_model
from app.auth import HARDCODED_USERNAME, require_session
from app.board import (
    BoardData,
    CardNotFoundError,
    ColumnNotFoundError,
    create_card_in_db,
    delete_card_in_db,
    get_board_id_for_user,
    load_board,
    parse_card_id,
    parse_column_id,
    rename_column_in_db,
    update_card_in_db,
)
from app.db import get_connection

router = APIRouter(prefix="/api", dependencies=[Depends(require_session)])

RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "kanban_chat_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "reply": {"type": "string"},
                "actions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": [
                                    "rename_column",
                                    "create_card",
                                    "update_card",
                                    "move_card",
                                    "delete_card",
                                ],
                            },
                            "column_id": {"type": ["string", "null"]},
                            "card_id": {"type": ["string", "null"]},
                            "title": {"type": ["string", "null"]},
                            "details": {"type": ["string", "null"]},
                        },
                        "required": [
                            "type",
                            "column_id",
                            "card_id",
                            "title",
                            "details",
                        ],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["reply", "actions"],
            "additionalProperties": False,
        },
    },
}

SYSTEM_PROMPT = """You are an assistant embedded in a Kanban board app. \
You can see the current board as JSON (columns in order, and a cards lookup \
map keyed by card id). Respond conversationally to the user's message in \
`reply`. If the user asks you to create, edit, move, or delete cards, or \
rename columns, express those changes as a list of `actions`. If no board \
change is needed, return an empty actions list.

Action types:
- rename_column: requires column_id and title.
- create_card: requires column_id and title; details is optional.
- update_card: requires card_id, and title and/or details to change.
- move_card: requires card_id and column_id (the destination column).
- delete_card: requires card_id.

Only reference column_id and card_id values that already exist in the board \
JSON provided to you. Leave fields you are not using set to null."""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    board: BoardData


def _apply_action(conn, board_id: int, action: dict) -> None:
    action_type = action.get("type")
    column_id = action.get("column_id")
    card_id = action.get("card_id")
    title = action.get("title")
    details = action.get("details")

    if action_type == "rename_column" and column_id and title:
        rename_column_in_db(conn, parse_column_id(column_id), title)
    elif action_type == "create_card" and column_id and title:
        create_card_in_db(conn, parse_column_id(column_id), title, details or "")
    elif action_type == "update_card" and card_id:
        update_card_in_db(conn, parse_card_id(card_id), title=title, details=details)
    elif action_type == "move_card" and card_id and column_id:
        update_card_in_db(
            conn, parse_card_id(card_id), column_id=parse_column_id(column_id)
        )
    elif action_type == "delete_card" and card_id:
        delete_card_in_db(conn, parse_card_id(card_id))


@router.post("/chat")
def chat(body: ChatRequest) -> ChatResponse:
    conn = get_connection()
    try:
        board_id = get_board_id_for_user(conn, HARDCODED_USERNAME)
        board = load_board(conn, board_id)

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.append(
            {
                "role": "system",
                "content": f"Current board JSON: {board.model_dump_json()}",
            }
        )
        for turn in body.history:
            messages.append({"role": turn.role, "content": turn.content})
        messages.append({"role": "user", "content": body.message})

        client = get_client()
        completion = client.chat.completions.create(
            model=get_model(),
            messages=messages,
            response_format=RESPONSE_SCHEMA,
        )
        raw_content = completion.choices[0].message.content
        try:
            parsed = json.loads(raw_content) if raw_content else None
        except json.JSONDecodeError:
            parsed = None

        if not isinstance(parsed, dict):
            return ChatResponse(
                reply="Sorry, I couldn't process that. Please try again.",
                board=board,
            )

        for action in parsed.get("actions", []):
            try:
                _apply_action(conn, board_id, action)
            except (ColumnNotFoundError, CardNotFoundError, ValueError, TypeError):
                continue
        conn.commit()

        updated_board = load_board(conn, board_id)
        return ChatResponse(reply=parsed.get("reply", ""), board=updated_board)
    finally:
        conn.close()
