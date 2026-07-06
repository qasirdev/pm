import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  onRename,
  onAddCard,
  onDeleteCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "panel flex min-h-[540px] min-w-0 flex-col rounded-3xl p-4 transition",
        isOver && "border-[var(--line-strong)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="signal-rail mb-4 w-full" data-live={isOver} />
      <div className="flex items-center justify-between gap-3">
        <input
          value={column.title}
          onChange={(event) => onRename(column.id, event.target.value)}
          className="ring-focus min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 font-display text-lg font-semibold text-[var(--ink)] outline-none"
          aria-label="Column title"
        />
        <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--field)] px-2.5 py-0.5 font-display text-xs font-semibold tabular-nums text-[var(--ink-dim)]">
          {cards.length}
        </span>
      </div>
      <div className="scroll-slim mt-4 flex flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--line)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Drop a card here
          </div>
        )}
      </div>
      <NewCardForm
        onAdd={(title, details) => onAddCard(column.id, title, details)}
      />
    </section>
  );
};
