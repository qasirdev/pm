# Database

## Engine and location

SQLite, via Python's standard library (or a thin wrapper such as `sqlite3`
directly — no ORM is needed for a schema this small). The database file lives
at `backend/data/app.db` (created on first run if missing; the `data/`
directory is gitignored). Inside the Docker container this path is not
volume-mounted for the MVP, so the database resets on container rebuild —
acceptable for local development where the app is meant to be started/stopped
via `scripts/`.

## Schema

See `docs/schema.json` for the full column-level definition. Four tables:

- `users` — one row per user. MVP seeds exactly one hardcoded row
  (`user` / `password`) on first run if the table is empty.
- `boards` — one row per user (`user_id` is unique), even though the schema
  itself supports multiple boards per user later by dropping that
  constraint.
- `columns` — belongs to a board, ordered by an integer `position`.
- `cards` — belongs to a column, ordered by an integer `position`.

## Password storage

Storing the password as a plain-text column is a deliberate simplification,
not an oversight: this is a local-only MVP with a single hardcoded
credential pair that's already public in `AGENTS.md`, so hashing buys no
real security here. Do not carry this forward if the app ever handles real
user-chosen passwords — bcrypt/argon2 hashing would be required at that
point.

## Mapping to the frontend `BoardData` shape

The frontend's normalized shape (`frontend/src/lib/kanban.ts`) is:

```ts
type BoardData = { columns: Column[]; cards: Record<string, Card> };
```

`GET /api/board` (Part 6) assembles this shape from the relational tables:
`columns` ordered by `position`, each with `cardIds` from its `cards` ordered
by `position`, and a `cards` lookup map keyed by card id (stringified). This
is a straightforward two-query join (columns, then cards), not a stored JSON
blob — keeping the relational structure means moving/reordering cards is a
simple `UPDATE ... SET column_id = ?, position = ?` rather than rewriting an
entire JSON document.

## Ordering strategy

Integer `position` columns (0-based, per-parent) were chosen over a linked
list (`next_card_id` pointers) because:

- It matches the array-order model the frontend already uses
  (`Column.cardIds: string[]`), so translating a fetched board into
  `BoardData` is a plain `ORDER BY position` query with no pointer-chasing.
- Reordering within a column or moving between columns is a small number of
  `UPDATE` statements that shift `position` values for affected siblings,
  which is simple enough at the expected scale (a handful of columns, dozens
  of cards) without needing fractional/sparse positions.

## Creation on first run

On backend startup: if `backend/data/app.db` does not exist, create it and
run the table-creation SQL, then seed the single hardcoded user and an empty
default board (5 fixed columns, no cards — or seeded with the same demo
cards as the frontend's current `initialData`, for a nicer first-run
experience). If the file already exists, skip creation/seeding entirely.
