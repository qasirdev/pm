import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/icons";

const initialFormState = { title: "", details: "" };

type NewCardFormProps = {
  onAdd: (title: string, details: string) => void;
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      return;
    }
    onAdd(formState.title.trim(), formState.details.trim());
    setFormState(initialFormState);
    setIsOpen(false);
  };

  return (
    <div className="mt-4">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={formState.title}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Card title"
            className="ring-focus w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm font-medium text-[var(--ink)] placeholder:text-[var(--muted)] outline-none transition"
            required
          />
          <textarea
            value={formState.details}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, details: event.target.value }))
            }
            placeholder="Details"
            rows={3}
            className="ring-focus w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm text-[var(--ink-dim)] placeholder:text-[var(--muted)] outline-none transition"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="ring-focus rounded-full bg-[var(--iris)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-115"
            >
              Add card
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFormState(initialFormState);
              }}
              className="ring-focus rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="ring-focus flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sky)] transition hover:border-[var(--sky)] hover:bg-[var(--sky)]/5"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add a card
        </button>
      )}
    </div>
  );
};
