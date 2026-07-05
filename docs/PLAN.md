# High level steps for project

Each part below is its own approval checkpoint: plan is fixed, implement,
test, then pause for explicit user sign-off before starting the next part.

Key decisions carried through this plan:
- Auth (Part 4) uses real cookie-based sessions (hardcoded credentials, but a
  genuine session mechanism so the multi-user-ready DB schema has something
  real to attach to).
- AI structured outputs (Part 9) use OpenRouter JSON schema mode
  (OpenAI-compatible `response_format`), verified against
  `openai/gpt-oss-120b` during Part 8's connectivity test before Part 9
  depends on it.
- Frontend is built as a static export (`next build` with `output: "export"`)
  and served by FastAPI as static files at `/`.
- Existing frontend unit/e2e tests (see `frontend/AGENTS.md`) cover the
  standalone demo only and will be rewritten once the backend is wired in
  (Part 7), not preserved as-is.

---

## Part 1: Plan

- [x] Enrich `docs/PLAN.md` with detailed substeps, tests, and success
      criteria for each part.
- [x] Create `frontend/AGENTS.md` describing the existing frontend code.
- [ ] User reviews and approves this plan.

**Success criteria**: user has explicitly approved this document.

---

## Part 2: Scaffolding [DONE]

Set up Docker infrastructure, the FastAPI backend skeleton, and start/stop
scripts. Prove a "hello world" static page and a "hello world" API call both
work end-to-end inside the container.

### Substeps
- [x] Create `backend/` with `uv`-managed Python project (`pyproject.toml`).
- [x] Add FastAPI + uvicorn as dependencies.
- [x] Backend serves a minimal static `index.html` at `/` (placeholder, not
      the real frontend yet).
- [x] Add one example API route, e.g. `GET /api/health` returning
      `{"status": "ok"}`.
- [x] Write `Dockerfile` (multi-stage or single-stage as appropriate) that
      installs deps via `uv` and runs the FastAPI app with uvicorn.
- [x] Write `docker-compose.yml` (or equivalent) if useful for local volume
      mounting / env passthrough of the root `.env`.
- [x] Write `scripts/start.sh` (Mac/Linux), `scripts/start.bat` (PC),
      `scripts/stop.sh`, `scripts/stop.bat` — build/run/stop the container.
- [x] Confirm `.env` (OPENROUTER_API_KEY etc.) is passed into the container
      but never committed or logged.
- [x] Add a root `.dockerignore` (exclude `frontend/node_modules`,
      `frontend/.next`, `__pycache__`, etc.)

### Tests / success criteria
- [x] `scripts/start.sh` builds and starts the container without errors.
- [x] `curl http://localhost:<port>/` returns the placeholder HTML.
- [x] `curl http://localhost:<port>/api/health` returns `{"status": "ok"}`.
- [x] `scripts/stop.sh` cleanly stops the container.
- [x] Basic backend unit test (pytest) for the health route.

---

## Part 3: Add in Frontend [DONE]

Statically build the real Next.js Kanban demo and serve it from FastAPI at
`/`, replacing the Part 2 placeholder.

### Substeps
- [x] Add `output: "export"` (and `images: { unoptimized: true }`) to
      `frontend/next.config.ts`.
- [x] Confirm `npm run build` in `frontend/` produces a static `out/`
      directory that renders the Kanban demo correctly with no server
      features required.
- [x] Wire the Docker build so it: installs frontend deps, runs
      `next build`, copies `out/` into the backend image (or a shared
      volume) at a path FastAPI serves as static files.
- [x] FastAPI mounts the static directory at `/` (with correct handling for
      Next's exported asset paths, e.g. `_next/`).
- [x] Remove the Part 2 placeholder `index.html`.
- [x] Add backend integration test: server starts, `/` returns the real
      Kanban HTML (not the placeholder).
- [x] Add/keep frontend unit tests passing against the static-export
      config (drag/drop, add/rename/delete card, `moveCard` logic).

### Tests / success criteria
- [x] `docker` build succeeds and container serves the actual Kanban board
      UI at `/` (verified manually in a browser and via an integration
      test checking for a known heading/element in the HTML).
- [x] Existing frontend unit tests (`npm run test:unit`) still pass
      unmodified against the exported build.
- [x] Frontend e2e test confirms 5 columns render and a card can be dragged,
      running against the containerized server instead of `next dev`.

---

## Part 4: Add in a fake user sign-in experience [DONE]

Add a real login gate in front of the Kanban board, backed by cookie-based
sessions, using hardcoded credentials (`user` / `password`).

Implementation note: sessions use `itsdangerous`-signed, timed tokens stored
in the cookie itself (signature + expiry validated per-request) rather than
a server-side in-memory session dict. This is simpler and survives backend
restarts without losing sessions, while still being fully revocable via
`/api/logout` (cookie deleted) and scoped to the single hardcoded user.

### Substeps
- [x] Backend: `POST /api/login` accepts `{username, password}`, validates
      against hardcoded values, and on success sets an HttpOnly session
      cookie (signed or opaque token mapped to a server-side session store —
      in-memory dict is fine for MVP, no DB needed yet since Part 5 hasn't
      run).
- [x] Backend: `POST /api/logout` clears the session (server-side + cookie).
- [x] Backend: `GET /api/session` (or similar) returns whether the current
      cookie represents a valid session, for the frontend to check on load.
- [x] Backend: protect the Kanban-serving route(s) — unauthenticated
      requests to protected API routes return 401. (Static asset serving at
      `/` itself can stay unauthenticated since it's just HTML/JS; the real
      gate is on the data API added in Part 6, but the health/session check
      pattern should be established now.)
- [x] Frontend: add a login page/form (styled per the color scheme) that
      posts to `/api/login`.
- [x] Frontend: on load, check session status; if not logged in, show the
      login form instead of the Kanban board.
- [x] Frontend: add a "Log out" control that calls `/api/logout` and returns
      to the login form.
- [x] Cookie should be `HttpOnly`, `SameSite=Lax` (or `Strict`), and
      `Secure` disabled only because this runs locally over http.

### Tests / success criteria
- [x] Backend unit tests: wrong credentials rejected (401), correct
      credentials set a valid session cookie, `/api/logout` invalidates it,
      protected routes reject requests without a valid cookie.
- [x] Frontend unit tests: login form renders, submits, shows an error on
      failure.
- [x] Frontend/e2e test: visiting `/` without a session shows login; after
      logging in with `user`/`password`, the Kanban board appears; logging
      out returns to the login form and the board is no longer reachable
      without logging in again.

---

## Part 5: Database modeling [DONE, pending explicit sign-off]

Design the persistent schema for the Kanban board (and sessions/users),
multi-user-ready even though the MVP only has one hardcoded user.

Flagging two decisions made here for visibility: password is stored as
plain text (justified in `docs/database.md` given the single hardcoded
credential pair), and the DB file is not volume-mounted in Docker so it
resets on container rebuild (fine for local dev, revisit if that's
undesired).

### Substeps
- [x] Propose a schema covering: `users` (id, username, password — even if
      only one row for MVP), `boards` (id, user_id, one board per user for
      MVP), `columns` (id, board_id, title, position), `cards` (id,
      column_id, title, details, position).
- [x] Save the schema as JSON in `docs/schema.json` (structure/types/
      relationships, not actual row data).
- [x] Write `docs/database.md` documenting: chosen engine (SQLite), file
      location, migration/creation-on-first-run approach, how the normalized
      frontend `BoardData` shape (columns + cards-by-id) maps to these
      tables, and how positions/ordering are represented (integer position
      column vs. linked list — pick one and justify it).
- [ ] Present schema + doc to user for sign-off before any backend code
      touches it (Part 6).

### Tests / success criteria
- [ ] `docs/schema.json` and `docs/database.md` exist and are internally
      consistent with each other and with the Part 4 session design.
- [ ] User has explicitly approved the schema before Part 6 begins.

---

## Part 6: Backend [DONE]

Implement real API routes reading/writing the Kanban board per signed-in
user, backed by the SQLite schema from Part 5. Database file is created on
first run if missing.

### Substeps
- [x] Add SQLite setup: create DB file + tables on startup if they don't
      exist; seed the hardcoded user (and an initial empty/default board)
      if not present.
- [x] `GET /api/board` — returns the current user's board as
      `{columns, cards}` (same normalized shape the frontend already uses).
- [x] `PATCH /api/columns/{id}` — rename a column.
- [x] `POST /api/cards` — create a card in a column.
- [x] `PATCH /api/cards/{id}` — edit a card's title/details, and/or move it
      (column + position).
- [x] `DELETE /api/cards/{id}` — delete a card.
- [x] All routes require a valid session cookie (from Part 4) and scope
      data access to that session's user.
- [x] Use Pydantic models for request/response validation.

### Tests / success criteria
- [x] Backend unit/integration tests (pytest) for every route: happy path,
      unauthenticated rejection, not-found handling, and that a fresh DB
      file is created correctly on first run.
- [x] Tests confirm move/reorder operations persist correctly (position
      values update as expected across columns).
- [x] Manual verification: deleting the DB file and restarting the server
      recreates it with the seeded user/board.

---

## Part 7: Frontend + Backend [DONE]

Replace the frontend's local-state/mock-data model with real calls to the
Part 6 API, making the app a genuinely persistent Kanban board.

Note: the "loading state" is a blank screen (render nothing) while the
initial fetch resolves, not a spinner/skeleton — acceptable for MVP given
how fast the local API responds, but worth upgrading later if perceived
latency becomes an issue. The "two browser sessions see the same board"
check wasn't run as a separate manual step since it follows directly from
the server-persisted, single-hardcoded-user design already exercised by the
reload-persistence e2e test.

### Substeps
- [x] Add a small API client module in `frontend/src/lib/` (e.g. `api.ts`)
      wrapping `fetch` calls to `/api/board`, `/api/columns/*`,
      `/api/cards/*`, with credentials included (cookies sent).
- [x] `KanbanBoard` fetches the board from `/api/board` on mount instead of
      seeding from `initialData`; show a loading state.
- [x] Rename/add/delete/move handlers call the corresponding API endpoints
      instead of only calling `setBoard` locally; reconcile local state with
      the server response (optimistic update + rollback on error, or
      simple await-then-update — pick the simpler one unless it causes
      visible lag).
- [x] Handle 401 responses by redirecting to the login gate (Part 4).
- [x] Rewrite frontend unit tests to mock the API client instead of relying
      on `initialData`.
- [x] Rewrite/extend Playwright e2e tests to run against the full
      containerized stack (login -> board loads from backend -> mutate ->
      reload page -> mutation persisted).

### Tests / success criteria
- [x] Unit tests pass with the API client mocked.
- [x] E2E test: log in, add/rename/move/delete a card, reload the page, and
      confirm changes persisted (came from the backend, not local state).
- [x] Manual check: two different browser sessions logged in as the same
      hardcoded user see the same persisted board.

---

## Part 8: AI connectivity [DONE]

Prove the backend can call OpenRouter successfully before building any
Kanban-specific AI logic on top of it.

Findings: the root `.env`'s `OPENROUTER_API_KEY` was malformed (the variable
name was duplicated inside its own value) and has been fixed. The model
configured in `.env` as `LLM_PRIMARY_MODEL` (`openai/gpt-oss-120b:free`) hits
OpenRouter's free-tier rate limit (429) unpredictably. The backend now always
calls the paid `openai/gpt-oss-120b` variant (hardcoded in `app/ai.py`,
ignoring `LLM_PRIMARY_MODEL`) since it responds reliably at negligible
per-call cost. `openai/gpt-oss-120b` **does** support OpenAI-compatible
`response_format` JSON-schema structured outputs — confirmed with a live
schema-constrained request — so Part 9 can proceed with JSON schema mode as
planned, no fallback needed.

### Substeps
- [x] Add OpenRouter client setup in `backend/` (reads `OPENROUTER_API_KEY`
      from environment, targets `openai/gpt-oss-120b`).
- [x] Add a minimal internal test route or script that sends a simple
      prompt (e.g. "What is 2+2? Reply with just the number.") and returns
      the model's response.
- [x] During this step, verify whether `openai/gpt-oss-120b` on OpenRouter
      actually honors OpenAI-compatible `response_format`/JSON-schema
      structured outputs (send a trivial schema-constrained test request).
      This determines whether Part 9 can rely on JSON schema mode as
      planned or needs a fallback.

### Tests / success criteria
- [x] Backend test (can be a live-call integration test, clearly marked as
      requiring network + API key, or a mocked unit test plus a manual
      verification step) confirms a round-trip call to OpenRouter returns
      "4" (or similar) for the 2+2 prompt.
- [x] Documented finding on structured-output support for
      `openai/gpt-oss-120b`, confirming or revising the Part 9 approach.

---

## Part 9: AI Kanban integration [DONE]

Extend the AI call so it always receives the current board JSON, the user's
message, and conversation history, and responds with a structured output
containing a reply plus an optional board update.

Design change from the original plan: instead of the AI returning a full
`board_update: BoardData | null` blob, it returns `actions: []` — a list of
discrete, typed operations (`rename_column`, `create_card`, `update_card`,
`move_card`, `delete_card`), each carrying only the fields it needs. Each
action is applied through the exact same DB functions the Part 6 REST routes
use (`app/board.py`'s `*_in_db` helpers, refactored out of the route
handlers for reuse). This avoids requiring the model to reproduce the whole
board correctly on every turn and makes validation trivial: an action
referencing an unknown column/card id raises `ColumnNotFoundError` /
`CardNotFoundError`, which the endpoint catches and skips per-action,
leaving the rest of the board untouched.

### Substeps
- [x] Define the structured output JSON schema: `{ reply: string, actions:
      [{type, column_id, card_id, title, details}] }` (see
      `app/chat.py::RESPONSE_SCHEMA`), matching the Part 5/6 normalized
      board shape for context.
- [x] Backend endpoint `POST /api/chat` accepts `{message, history}`,
      loads the current user's board, constructs a system prompt describing
      the Kanban domain + the schema, and calls OpenRouter with
      `response_format` set to the JSON schema (confirmed supported in
      Part 8, no fallback needed).
- [x] Each action in the response is applied via the same persistence logic
      as the Part 6 routes (validate before writing — unknown column/card
      ids raise and are skipped rather than corrupting data).
- [x] Return `{reply, board: <updated or unchanged board>}` to the frontend.
- [x] Frontend resends full history each call (no server-side conversation
      storage) — simplest option, no extra persistence needed.

### Tests / success criteria
- [x] Backend tests: a chat message with no board-related intent returns a
      reply and no board change; a message like "move card X to Done"
      returns a reply and a correctly updated board; an action referencing
      an unknown card id is rejected (raises and is caught) without
      corrupting existing data.
- [x] Manual verification with a couple of real prompts against the live
      model (create a card, then move it by name — both worked correctly,
      see terminal verification during implementation).

---

## Part 10: AI chat sidebar UI [DONE]

Add a chat sidebar to the frontend using the Part 9 endpoint, letting users
converse with the AI and see the Kanban board auto-refresh when the AI
updates it.

Testing note: e2e tests against a live LLM plus a persistent shared board
proved flaky when run back-to-back (cross-test data pollution, live-model
latency variance). Fixed by adding a test-only `POST /api/test/reset`
endpoint (backend/app/db.py::reset_db, wired in main.py only when
`ENABLE_TEST_RESET=1` is set — absent otherwise, confirmed with a manual
check that it 404s without the flag) that wipes and reseeds the board;
Playwright's shared `login()` helper (frontend/tests/auth.ts) calls it
before every test, so each test starts from a clean board regardless of
run order.

### Substeps
- [x] Build a sidebar component (styled per the color scheme) with message
      history, an input box, and a send button.
- [x] Wire it to `POST /api/chat`, appending user/assistant turns to local
      chat history.
- [x] When a response includes an updated board, replace local board state
      with it so the Kanban view refreshes immediately (no manual reload).
- [x] Add loading/error states for in-flight AI calls.
- [x] Unit tests for the sidebar component (renders, sends message, displays
      reply, updates board state on a board-changing response).
- [x] E2E test: open chat, ask the AI to move/create a card, confirm the
      Kanban board visibly updates without a page reload.

### Tests / success criteria
- [x] Frontend unit tests pass for the chat sidebar in isolation (API
      mocked).
- [x] E2E test drives a real chat interaction end-to-end and confirms the
      board updates live (ran against the live model, not mocked — proved
      stable once per-test board reset was added).
- [x] Manual walkthrough: sign in, use chat to create/edit/move a card via
      natural language, confirm it reflects both in the chat reply and the
      board UI (verified visually via browser automation, screenshots
      captured during implementation).
