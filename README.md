# Kanban Studio — AI-Powered Project Management

An AI-powered Kanban project management web app: sign in, work a drag-and-drop board, and manage cards through natural language with an AI assistant that can create, edit, move, and delete cards on your behalf.

![Python](https://img.shields.io/badge/Python-3.14-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)
![OpenRouter](https://img.shields.io/badge/OpenRouter-LLM-6E56CF)

> Designed, built, and tested end-to-end with the [Claude Code](https://claude.com/claude-code) CLI.

<img width="1506" height="826" alt="image" src="https://github.com/user-attachments/assets/e93515b9-7ce6-45e5-8190-f3b5c65569b5" />


## Overview

Kanban Studio is a full-stack, production-shaped MVP that pairs a modern drag-and-drop board with an LLM assistant. The AI receives the live board state and the user's message, then returns a set of typed, validated actions applied through the same persistence layer as the REST API — no parallel mutation path, no full-board round-trips.

The entire stack ships as a single Docker container: a Next.js frontend statically exported and served by a Python FastAPI backend, SQLite for storage, and OpenRouter for the model.

## Features

- Cookie-based authentication with signed, stateless session tokens
- Kanban board with fixed, renameable columns
- Drag-and-drop card reordering, within and across columns, persisted server-side
- Create, edit, and delete cards
- AI assistant (floating chat) that creates, edits, moves, and deletes cards from natural language
- Live board refresh when the AI makes changes — no page reload
- Graceful degradation when the model is unavailable (the board stays untouched)

## Tech Stack

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | Next.js (static export), React, TypeScript, Tailwind CSS, dnd-kit |
| Backend    | Python, FastAPI, Pydantic, uvicorn                                |
| Database   | SQLite (raw `sqlite3`, WAL mode)                                   |
| AI         | OpenRouter (`openai/gpt-oss-120b`) with JSON-schema structured outputs |
| Packaging  | Docker (multi-stage build), single-container deploy               |
| Tooling    | uv (Python), npm (Node)                                            |
| Testing    | pytest, Vitest + Testing Library, Playwright                      |

## Architecture

One FastAPI process serves both the JSON API under `/api/*` and the static frontend at `/`. The frontend is built once (`next build` with `output: "export"`) and copied into the backend image, so everything is same-origin — no CORS, and the signed session cookie is safe against CSRF by design.

The AI does not return a replacement board. It returns `{ reply, actions[] }`, where each action (`rename_column`, `create_card`, `update_card`, `move_card`, `delete_card`) is validated and applied through the exact `*_in_db` functions the REST routes use. Unknown card/column references are skipped per-action rather than failing the whole request.

## Quick Start

Requires Docker.

```bash
# Add your OpenRouter key
echo "OPENROUTER_API_KEY=sk-or-..." > .env

# Build and run (serves at http://localhost:8000)
./scripts/start.sh

# Stop
./scripts/stop.sh
```

Sign in with the MVP credentials `user` / `password`.

Windows equivalents: `scripts/start.bat` and `scripts/stop.bat`.

## Local Development

Backend (from `backend/`):

```bash
uv sync
uv run uvicorn app.main:app --reload
uv run pytest
```

Frontend (from `frontend/`):

```bash
npm install
npm run dev
npm run test:unit
npm run test:e2e
```

## Testing

- Backend: pytest, with live OpenRouter-calling tests gated behind a `live` marker
- Frontend unit: Vitest + Testing Library, colocated with components
- End-to-end: Playwright, covering login, board mutations, persistence across reloads, and a live AI chat flow

## License

MVP built for demonstration purposes.
