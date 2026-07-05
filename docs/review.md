# Code Review — Project Management MVP

Reviewed: full backend (`backend/app`, `backend/tests`), frontend
(`frontend/src`, `frontend/tests`), Docker setup, and scripts.

**Status: all Critical/High/Medium findings below have been remediated and
retested (backend pytest, frontend vitest, and Playwright e2e all green;
see "Remediation" note on each item). Low-priority items are left as-is —
noted for awareness, not blocking.**

Severity legend: **[High]** correctness/security worth fixing soon ·
**[Medium]** should fix · **[Low]** polish / nice-to-have.

---

## Security

### S1. [High] Passwords stored in plain text — FIXED
`backend/app/db.py` seeded and stored the user password as plain text, and
`backend/app/auth.py` compared credentials with a plain `==`.

**Remediation:** `auth.py` now hashes the password with PBKDF2-HMAC-SHA256
(`hash_password`, 260k iterations, fixed salt — see code comment for why a
fixed salt is acceptable with exactly one hardcoded account) and stores only
the hash in the `users` table. `docs/database.md` updated to match.

### S2. [Medium] Credential check is not constant-time — FIXED
`verify_credentials` used `==` on username and password, leaking timing
information.

**Remediation:** both comparisons now use `hmac.compare_digest`.

### S3. [Medium] Session cookie `secure` flag never set — FIXED
No mechanism existed to enable `secure` when deployed over HTTPS.

**Remediation:** added `COOKIE_SECURE` env var (`auth.py`, default off) wired
into `main.py`'s `set_cookie` call. Set `COOKIE_SECURE=1` when serving over
HTTPS.

### S4. [Medium] No CORS configuration / same-origin assumption undocumented — DOCUMENTED
**Remediation:** added a comment in `main.py` above the `FastAPI(...)`
instantiation explaining the same-origin design and why CORS middleware
should not be added (would combine with cookie auth to create a CSRF risk).
No code change needed — the absence of CORS was already correct.

### S5. [Low] Session secret file written world-readable
`auth.py:_load_or_create_secret_key` writes `.session_secret` with default
permissions. Not addressed — acceptable for local-only use; revisit if this
ever runs on a shared multi-user machine (`os.chmod(path, 0o600)` after
write would close it).

---

## Correctness / Robustness

### C1. [Medium] `get_board_id_for_user` assumes user and board always exist — FIXED
Missing null checks meant a corrupt DB state would surface as a bare
`NoneType` subscript `TypeError`.

**Remediation:** added `UserNotFoundError` / `BoardNotFoundError`, raised
explicitly and caught by both `GET /api/board` and `POST /api/chat`, which
now return a clear `500` with a diagnosable message instead of crashing.

### C2. [Medium] No visibility into partially-applied chat actions — FIXED
A multi-action AI response could silently skip actions that referenced
unknown ids, with no signal to the user.

**Remediation:** `chat.py` now counts skipped actions and appends a note to
the reply (e.g. "(Note: 1 requested action could not be applied and were
skipped.)") when any are dropped. Covered by
`test_chat_route_ignores_action_with_unknown_card_id`.

### C3/C4/C5. [Medium/Low] In-column reorder didn't persist; stale-closure risk — FIXED
The frontend showed in-column drag reordering locally, but only sent the
destination `column_id` to the backend (never a position), so the order
reverted on reload. `handleDragEnd` also read the outer `board` closure
directly instead of using the functional `setBoard` updater used everywhere
else in the component.

**Remediation:**
- `backend/app/board.py`: `update_card_in_db` and its `_compact_column_positions`
  helper now properly shift sibling positions and support inserting a card
  at an explicit `position`, for both same-column reorders and cross-column
  moves with a target index.
- `frontend/src/lib/api.ts`: `moveCardApi` now takes and sends `position`.
- `frontend/src/components/KanbanBoard.tsx`: `handleDragEnd` rewritten to
  use the functional `setBoard(prev => ...)` form throughout (fixes the
  stale-closure risk), computes the real target index, and short-circuits
  (no API call) when the drop is a genuine no-op (same column, same index).
- New backend tests: `test_reorder_cards_within_a_column`,
  `test_move_card_to_specific_position_in_another_column`.
- New e2e test: `reordering cards within a column persists across reload`.
- Manually verified in a real browser: drag-reorder within a column, reload,
  order persists correctly.

### C6. [Low] `read_session_username` only catches `BadSignature`
Not changed — `BadSignature` already covers the practical cases
(`SignatureExpired` is a subclass). Left as-is.

### C7. [Low→addressed] AI ping / chat could raise raw OpenAI exceptions as 500 — FIXED
Neither `ai_ping` nor the `/api/chat` OpenRouter call was wrapped, so a
network error or rate-limit would surface as an unhandled 500.

**Remediation:** `ai_ping` now catches `OpenAIError` and returns a `502`
with a clear detail message. `/api/chat` catches `OpenAIError` around the
completion call and returns a graceful "AI assistant is temporarily
unavailable" reply with the board unchanged, instead of crashing. Covered
by `test_chat_handles_openrouter_error_gracefully` (mocked, no live call
needed).

---

## Concurrency / Data layer

### D1. [Medium] No WAL mode / busy timeout — FIXED
Every request opens its own SQLite connection with default settings, risking
`database is locked` under concurrent writers.

**Remediation:** `get_connection` now sets `PRAGMA journal_mode = WAL` and
`PRAGMA busy_timeout = 5000` on every connection. Documented in
`docs/database.md`.

### D2. [Low] `get_connection` created the data dir on every call — FIXED
**Remediation:** the `mkdir` call moved to `init_db` (runs once at startup)
instead of running on every `get_connection()` call.

---

## Frontend

(F1 covered above under C3/C4/C5.)

### F2. [Low] Non-401 mutation errors are silently swallowed
Not changed — `handleRenameColumn`/`handleAddCard`/`handleDeleteCard` still
only react to 401. Left as a known gap; would need a toast/error UI
component to address properly, which felt like scope creep beyond this
review's remediation pass.

### F3. [Low] `page.tsx` renders `null` while checking session
Not changed — accepted MVP tradeoff, already noted in `docs/PLAN.md`.

### F4. [Low] `fetchSession` does not distinguish 401 from network error
Not changed.

### F5. [Low] Chat history uses array index as React key
Not changed — safe given the list is append-only.

---

## Testing

### T1. [Medium] Live-LLM tests are inherently flaky and gated the whole suite — FIXED
**Remediation:** added a `live` pytest marker (`pyproject.toml`) and
`addopts = "-m 'not live'"` so the default `pytest` run excludes them
entirely (deterministic, ~1s). Marked
`test_ai_ping_answers_2_plus_2`, `test_chat_without_board_intent_leaves_board_unchanged`,
and `test_chat_creates_and_moves_a_card` with `@pytest.mark.live`. Run them
explicitly with `pytest -m live` when you have a working `OPENROUTER_API_KEY`
and want to smoke-test the real model.

### T2. [Low] E2E chat test also depends on the live model
Not changed — same rationale as T1's e2e counterpart; kept as a live smoke
test rather than mocked, since it's valuable to occasionally verify the real
integration end-to-end.

### T3. [Low→addressed] No pytest configuration block — FIXED
**Remediation:** added `[tool.pytest.ini_options]` to `backend/pyproject.toml`
with `testpaths = ["tests"]` and the `live` marker registration.

### T4. [Low] E2E relies on a persistent shared board + reset endpoint
**Remediation:** `docker-compose.yml` now has a comment explicitly warning
not to set `ENABLE_TEST_RESET` there, since it exposes an unauthenticated
board-wipe endpoint. The endpoint itself remains correctly gated behind that
env var (confirmed absent — 404 — when unset, verified manually).

---

## Build / Ops

### O1. [Medium] SQLite DB not persisted across container rebuilds — FIXED
**Remediation:** `docker-compose.yml` now mounts a named volume
(`db-data:/app/data`). Verified: created a card, rebuilt the image, restarted
the container — the card was still present. `docker compose down -v` still
wipes it explicitly if desired.

### O2. [Low] Bleeding-edge dependency versions
Not changed — `uv.lock` already pins exact versions for reproducibility.

### O3. [Low] `ai.py` loads `.env` from a hardcoded relative path
Not changed — works correctly for both local `uv run` and Docker (where
`.env` is absent and vars come from `env_file`/compose instead).

### O4. [Low] `.dockerignore` excludes `*.md` globally
Not changed — harmless, `backend/README.md` isn't needed at runtime.

---

## Style / Consistency (Low)

- **P1. FIXED** — all `raise HTTPException(...)` sites inside
  `except SomeError:` blocks (in `board.py` and the new handling in
  `main.py`/`chat.py`) now use `raise ... from error` for a clean exception
  chain.
- **P2. FIXED** — `_apply_action` no longer takes the unused `board_id`
  parameter.
- **P3.** Not changed — the `global _client` singleton in `ai.py` is simple
  and works; not worth the churn of a `lru_cache` refactor.
- **P4.** Not changed — IDE/workspace interpreter configuration, not a code
  issue.
- **P5.** Not changed — `LLM_PRIMARY_MODEL` / `LLM_OPENROUTER_MODELS` in
  `.env` remain unused (model is hardcoded in `ai.py` to avoid the
  rate-limited `:free` tier); still worth a cleanup pass but out of scope
  for this remediation.

---

## Verification performed after remediation

- Backend: `uv run pytest` — 27 passed, 3 deselected (live) in <1s.
- Backend: `uv run pytest -m live` — 3 passed (requires `OPENROUTER_API_KEY`).
- Frontend: `npm run test:unit` — 16 passed across 5 files.
- E2E (Playwright, against the Dockerized app): 9 passed, including new
  in-column-reorder-persists-across-reload test and the pre-existing
  cross-column-move/persist/auth/chat tests.
- Manual: rebuilt and restarted the Docker container to confirm SQLite data
  survives via the new named volume; confirmed the test-reset endpoint is
  absent (404) without `ENABLE_TEST_RESET=1`; logged in with the new
  password-hash verification in both pytest and a real browser; manually
  drag-reordered cards within a column in a real browser and confirmed the
  order survives a page reload.
- Server was started for this verification and stopped afterward.
