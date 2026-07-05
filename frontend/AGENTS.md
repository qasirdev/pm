# Frontend

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4. Currently a
standalone, frontend-only demo of the Kanban board with no backend, no auth,
and no AI chat wired up yet.

## Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout, fonts (Space Grotesk + Manrope), metadata
│   │   ├── page.tsx         # "/" route -> renders <KanbanBoard />
│   │   └── globals.css      # Tailwind import + color scheme as CSS custom properties
│   ├── components/
│   │   ├── KanbanBoard.tsx        # Owns board state, DndContext, drag overlay
│   │   ├── KanbanColumn.tsx       # Droppable column, sortable card list, rename input
│   │   ├── KanbanCard.tsx         # Sortable card, delete button
│   │   ├── KanbanCardPreview.tsx  # Non-interactive card clone for DragOverlay
│   │   └── NewCardForm.tsx        # Expandable "add card" form
│   ├── lib/
│   │   └── kanban.ts        # Types, mock initialData, pure moveCard logic, createId
│   └── test/
│       └── setup.ts         # Vitest + jest-dom setup
├── tests/
│   └── kanban.spec.ts       # Playwright e2e specs
├── vitest.config.ts
├── playwright.config.ts
└── next.config.ts           # Currently the default empty scaffold
```

Only one route exists (`/`). No API routes, no middleware, no dynamic segments.

## Data model

Normalized shape in `src/lib/kanban.ts`:

```ts
type Card = { id: string; title: string; details: string };
type Column = { id: string; title: string; cardIds: string[] };
type BoardData = { columns: Column[]; cards: Record<string, Card> };
```

`initialData` is hardcoded mock data (5 columns, 8 cards). `moveCard(columns, activeId, overId)`
is a pure function handling reorder-within-column, move-to-column-end, and
move-to-position-in-other-column; it's unit tested and should be preserved
when wiring up a backend. `createId(prefix)` generates client-side IDs — this
will be replaced by server-assigned IDs once persistence exists.

## State management

Plain React `useState` in `KanbanBoard.tsx`, passed down via props. No
context/Redux/Zustand, no data-fetching library. All mutations (rename, add,
delete, move) only update local state today — nothing persists across a
refresh.

## Drag and drop

`@dnd-kit/core` + `@dnd-kit/sortable`. `PointerSensor` with a 6px activation
distance, `closestCorners` collision detection. `DragOverlay` renders
`KanbanCardPreview` while dragging so the source card doesn't jitter.

## Styling

Tailwind CSS v4, utility classes with arbitrary values referencing CSS custom
properties (e.g. `text-[var(--navy-dark)]`), `clsx` for conditional classes.
The full brand color scheme from the root `AGENTS.md` is already defined in
`globals.css` and used consistently:

- `--accent-yellow` (#ecad0a): column accent bars, drop-target highlight
- `--primary-blue` (#209dd7): links/callouts, focus states
- `--secondary-purple` (#753991): primary submit buttons ("Add card")
- `--navy-dark` (#032147): headings, primary text
- `--gray-text` (#888888): supporting text, labels

## Testing

- Unit: Vitest + Testing Library, `jsdom` environment, tests colocated next
  to source (`Foo.tsx` + `Foo.test.tsx`). Run with `npm run test:unit`.
- E2E: Playwright, specs in `tests/`, auto-starts `next dev` on
  `127.0.0.1:3000` if not already running. Run with `npm run test:e2e`.
- `npm run test:all` runs both.

These tests currently cover the standalone demo only. They will need to be
rewritten/extended once the app is wired to a real backend (auth, API calls,
persistence) rather than local state and mock data.

## Conventions

- Components are named-export arrow functions (`export const Foo = () => {}`),
  not default exports (except `page.tsx`/`layout.tsx`, which follow Next's
  required convention).
- One component per file; filename matches the exported symbol.
- `"use client"` only declared where actually needed (currently just
  `KanbanBoard.tsx`); leaf components are transitively client components.
- Props types are co-located, non-exported `type XxxProps = {...}` above the
  component.
- Domain types/logic live in `src/lib/` (no React); UI lives in `src/components/`.
  Preserve this separation — e.g. a future API client belongs in `src/lib/`.
- No barrel (`index.ts`) files; imports use the `@/` path alias directly.

## Known gaps (not yet built)

- No auth/login UI of any kind.
- No AI chat sidebar UI.
- No HTTP/data-fetching layer — `initialData` is the only data source.
- `next.config.ts` is the default empty scaffold; static export
  (`output: "export"`) is not yet configured, which will be needed once
  FastAPI serves the built frontend.
