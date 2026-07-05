# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A single-user (MVP) Project Management web app: sign in, see a Kanban board, drag cards between fixed columns, chat with an AI assistant that can create/edit/move/delete cards on your behalf. NextJS frontend statically exported and served by a Python FastAPI backend, everything packaged into one Docker container, SQLite for storage, OpenRouter for the AI model.

See `AGENTS.md` for business requirements, technical decisions, and the color scheme. See `docs/PLAN.md` for the phased build plan (10 parts, all complete) and `docs/database.md` / `docs/schema.json` for the DB design. `docs/review.md` is a completed code-review remediation log — useful as a map of past correctness/security fixes.

## Commands

### Backend (run from `backend/`)

```bash
uv sync                                    # install deps
uv run uvicorn app.main:app --reload       # dev server
uv run pytest                              # run tests (excludes live-LLM tests by default)
uv run pytest -m live                      # include live OpenRouter-calling tests (needs OPENROUTER_API_KEY)
uv run pytest tests/test_board.py::test_reorder_cards_within_a_column   # single test
```

### Frontend (run from `frontend/`)

```bash
npm install
npm run dev            # next dev
npm run build           # static export (output: "export" in next.config.ts) -> out/
npm run test:unit       # vitest
npm run test:unit:watch
npm run test:e2e        # playwright, against next dev on 127.0.0.1:3000
npm run test:all        # unit + e2e
npx playwright test tests/kanban.spec.ts -g "reorder"   # single e2e test
```

### Whole app (Docker)

```bash
./scripts/start.sh      # docker compose up --build -d ; serves at http://localhost:8000
./scripts/stop.sh        # docker compose down
```

`scripts/start.bat` / `stop.bat` are the Windows equivalents. The compose file mounts a named volume (`db-data:/app/data`) so the SQLite DB survives rebuilds; `docker compose down -v` wipes it.

To run e2e tests against the real Dockerized backend instead of `next dev`, start a container with `ENABLE_TEST_RESET=1` (see "Test-only reset endpoint" below) and point Playwright's `baseURL` at it — do not set that env var in the normal `docker-compose.yml` service.

## Architecture

### Request flow and process layout

One FastAPI process serves both the API (`/api/*`) and the static frontend (`/`, mounted last via `StaticFiles` so it doesn't shadow API routes). There is no separate frontend dev server in production — `frontend/` is built once (`next build` with static export) and its `out/` directory is copied into the backend's `app/static/` at Docker build time (multi-stage `backend/Dockerfile`: a `node` stage builds the frontend, a `python` stage runs the API and serves the copied static files). Because everything is same-origin, there is deliberately no CORS middleware — adding permissive CORS would combine with the cookie-based session to create a CSRF hole (see comment in `backend/app/main.py`).

### Backend module layout (`backend/app/`)

- `main.py` — FastAPI app, lifespan (`init_db()` on startup), auth routes (`/api/login`, `/api/logout`, `/api/session`), `/api/ai/ping` (connectivity smoke test), the gated test-reset route, and mounts the `board` and `chat` routers plus the static files.
- `auth.py` — hardcoded single-user credentials (`user`/`password`, hashed with PBKDF2-HMAC-SHA256 before storage/comparison via `hmac.compare_digest`), `itsdangerous`-signed session cookie (no server-side session store — the signed token _is_ the session, verified stateless on each request), `COOKIE_SECURE` env var to toggle the `secure` cookie flag for HTTPS deployments.
- `db.py` — raw `sqlite3` (no ORM), schema creation and seeding, `reset_db()` for tests. Every connection runs `PRAGMA journal_mode = WAL` and `busy_timeout = 5000` since each request opens its own short-lived connection.
- `board.py` — Pydantic models (`Card`, `Column`, `BoardData`) and the `*_in_db` functions that do the actual SQL, wrapped by thin `@router` route handlers. **This module owns the ID-prefixing scheme** (see below) and the position-shifting logic for drag/reorder persistence.
- `chat.py` — the AI chat endpoint. Builds a system prompt containing the full board JSON, calls OpenRouter with a strict JSON-schema `response_format`, and applies the model's returned `actions` list through the same `*_in_db` functions `board.py`'s REST routes use (not a separate code path).
- `ai.py` — OpenRouter client singleton (`openai` SDK pointed at OpenRouter's base URL). The model is **hardcoded** to `openai/gpt-oss-120b` (not read from `.env`'s `LLM_PRIMARY_MODEL`) because the `:free` tier variant hits OpenRouter rate limits unpredictably — this was a deliberate fix, not an oversight, so don't "restore" the env-var-driven model selection without checking rate-limit behavior first.

### Card/column ID prefixing — read this before touching IDs

Columns and cards are separate SQLite auto-increment sequences, so a card and a column can have the same numeric `id`. The API therefore never exposes bare integer IDs: `board.py` prefixes them (`col-<n>`, `card-<n>`) via `column_id_to_str`/`card_id_to_str` before returning JSON, and unprefixes them via `parse_column_id`/`parse_card_id` (which raise `ColumnNotFoundError`/`CardNotFoundError` if the prefix doesn't match) when reading requests. A prior bug where the frontend's `moveCard` logic could confuse a card's own ID with a same-numbered column ID (breaking drag-and-drop) was root-caused to this exact collision and fixed by the prefixing scheme — **do not reintroduce bare numeric IDs anywhere in the API surface**.

### Drag-and-drop persistence

`board.py`'s `update_card_in_db` supports moving a card to a specific `position` within a column (not just "append to end"). `_compact_column_positions` renumbers a column's cards to a dense `0..n-1` sequence (excluding the card being moved, to avoid a FK violation from giving it a transient invalid `column_id`), then the target column is shifted to make room at the insertion index. The frontend (`frontend/src/components/KanbanBoard.tsx`) computes the real target index after a drag and sends it via `moveCardApi(cardId, columnId, position)` — both in-column reordering and cross-column moves go through this same path. `handleDragEnd` uses the functional `setBoard(prev => ...)` form throughout (not a captured outer variable) to avoid stale-closure bugs when the AI chat sidebar updates the board concurrently.

### AI chat action model

The AI does not return a full replacement board. It returns `{ reply: string, actions: [...] }` where each action is one of `rename_column` / `create_card` / `update_card` / `move_card` / `delete_card`, referencing existing `col-*`/`card-*` IDs from the board JSON it was given. Each action is applied through the _same_ `*_in_db` functions the REST API uses — there is no parallel "AI mutation" code path. Actions referencing unknown IDs are skipped individually (not a whole-request failure); if any are skipped, the reply gets an appended note so the user knows. If OpenRouter itself fails (network/rate-limit) or returns unparseable JSON, the chat endpoint degrades to a friendly reply with the board unchanged rather than a 500.

### Frontend structure (`frontend/src/`)

- `lib/kanban.ts` — pure domain types and the `moveCard` reorder algorithm (framework-agnostic, no React, no API calls). `initialData` here is unused mock data left from the original frontend-only demo; the app now always fetches from the backend.
- `lib/api.ts` — the only place that calls `/api/board`, `/api/columns/*`, `/api/cards/*`, `/api/chat`. Throws `ApiError` (carries `status`) on non-2xx.
- `lib/auth.ts` — `/api/login`, `/api/logout`, `/api/session` calls.
- `components/KanbanBoard.tsx` — owns board state (fetched from the backend on mount, not seeded from `lib/kanban.ts`'s mock data), the `DndContext`, and all mutation handlers. Renders `KanbanColumn` (droppable + sortable list) and `ChatSidebar` side by side.
- `components/ChatSidebar.tsx` — chat UI; on a response with board changes, calls `onBoardUpdate` to replace board state directly (no separate refetch/poll).
- Auth gating lives in `app/page.tsx`: checks `/api/session` on mount, renders `LoginForm` or `KanbanBoard` accordingly.

### Testing conventions

- Backend: pytest with a `live` marker for tests that make real OpenRouter calls (non-deterministic — excluded from the default run via `addopts` in `pyproject.toml`; run explicitly with `-m live`). Tests needing an isolated DB monkeypatch `app.db.DB_PATH` to a `tmp_path`.
- Frontend unit: Vitest + Testing Library, colocated `Foo.test.tsx` next to `Foo.tsx`, mocks `lib/api.ts` functions directly rather than mocking `fetch`.
- E2E: Playwright, in `frontend/tests/`. `tests/auth.ts`'s `login()` helper calls a test-only `POST /api/test/reset` endpoint before each test to guarantee a clean board — this route only exists when the backend is started with `ENABLE_TEST_RESET=1` (never set this in the real `docker-compose.yml` service; it's an unauthenticated board-wipe). When asserting persistence across a `page.reload()`, wait for the actual mutating network request to resolve first (`page.waitForResponse`) — waiting only for the optimistic local UI update to settle before reloading is a race that produces flaky "persistence" failures.
- Live-model tests (both pytest and the e2e chat spec) can genuinely fail non-deterministically because the underlying LLM doesn't always follow the system prompt — a failure there should be reproduced by rerunning before assuming it's a real regression.

## DETAILED PLAN

@docs/PLAN.md
