import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { TrashIcon } from "@/components/icons";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group cursor-grab rounded-2xl border border-[var(--line)] bg-[var(--panel-solid)] px-4 py-3.5 shadow-[var(--shadow-card)]",
        "transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--line-strong)] active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-display text-[0.95rem] font-semibold leading-snug text-[var(--ink)]">
            {card.title}
          </h4>
          <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
            {card.details}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="shrink-0 rounded-lg border border-transparent p-1.5 text-[var(--muted)] opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={`Delete ${card.title}`}
          title="Delete card"
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
};
