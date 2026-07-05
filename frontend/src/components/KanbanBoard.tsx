"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { ChatSidebar } from "@/components/ChatSidebar";
import { moveCard, type BoardData } from "@/lib/kanban";
import { logout } from "@/lib/auth";
import {
  ApiError,
  createCard,
  deleteCardApi,
  fetchBoard,
  moveCardApi,
  renameColumn,
} from "@/lib/api";

type KanbanBoardProps = {
  onLogout: () => void;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    fetchBoard()
      .then(setBoard)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          onLogout();
        }
      });
  }, [onLogout]);

  const cardsById = useMemo(() => board?.cards ?? {}, [board]);

  const handleApiError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      onLogout();
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const cardId = active.id as string;
    const overId = over.id as string;

    setBoard((prev) => {
      if (!prev) return prev;

      const previousColumns = prev.columns;
      const nextColumns = moveCard(prev.columns, cardId, overId);
      if (nextColumns === previousColumns) {
        return prev;
      }

      const targetColumn = nextColumns.find((column) =>
        column.cardIds.includes(cardId)
      );
      if (!targetColumn) {
        return prev;
      }
      const targetPosition = targetColumn.cardIds.indexOf(cardId);
      const sourceColumn = previousColumns.find((column) =>
        column.cardIds.includes(cardId)
      );
      const isUnchanged =
        sourceColumn?.id === targetColumn.id &&
        sourceColumn.cardIds.indexOf(cardId) === targetPosition;
      if (isUnchanged) {
        return prev;
      }

      moveCardApi(cardId, targetColumn.id, targetPosition).catch((error) => {
        setBoard((current) =>
          current ? { ...current, columns: previousColumns } : current
        );
        handleApiError(error);
      });

      return { ...prev, columns: nextColumns };
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map((column) =>
              column.id === columnId ? { ...column, title } : column
            ),
          }
        : prev
    );
    renameColumn(columnId, title).catch(handleApiError);
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const resolvedDetails = details || "No details yet.";
    createCard(columnId, title, resolvedDetails)
      .then((card) => {
        setBoard((prev) =>
          prev
            ? {
                ...prev,
                cards: { ...prev.cards, [card.id]: card },
                columns: prev.columns.map((column) =>
                  column.id === columnId
                    ? { ...column, cardIds: [...column.cardIds, card.id] }
                    : column
                ),
              }
            : prev
        );
      })
      .catch(handleApiError);
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
    deleteCardApi(cardId).catch(handleApiError);
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  if (!board) {
    return null;
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                One board. Five columns. Zero clutter.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="h-fit rounded-xl border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] transition-colors hover:text-[var(--navy-dark)]"
            >
              Log out
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <ChatSidebar onBoardUpdate={setBoard} onUnauthorized={onLogout} />
        </div>
      </main>
    </div>
  );
};
