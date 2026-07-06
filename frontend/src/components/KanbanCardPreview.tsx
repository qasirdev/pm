import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rotate-2 cursor-grabbing rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-solid)] px-4 py-3.5 shadow-[0_20px_40px_-12px_rgba(3,33,71,0.35)] ring-2 ring-[var(--signal)]/45">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="font-display text-[0.95rem] font-semibold leading-snug text-[var(--ink)]">
          {card.title}
        </h4>
        <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
          {card.details}
        </p>
      </div>
    </div>
  </article>
);
