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
import { ChatIcon, CloseIcon, LogOutIcon } from "@/components/icons";
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
  const [chatOpen, setChatOpen] = useState(false);

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

  const totalCards = Object.keys(cardsById).length;

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-[1920px] flex-col gap-6 px-6 pb-10 pt-6 2xl:px-10">
      <header className="panel flex flex-wrap items-center justify-between gap-4 rounded-3xl px-6 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--iris)]/12 ring-1 ring-[var(--iris)]/20">
            <span className="status-dot h-2.5 w-2.5 rounded-full bg-[var(--signal)]" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Kanban Studio
            </h1>
            <p className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <span className="eyebrow text-[10px] text-[var(--sky)]">
                Live
              </span>
              <span aria-hidden="true">·</span>
              {board.columns.length} lanes
              <span aria-hidden="true">·</span>
              {totalCards} cards
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="ring-focus flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
        >
          <LogOutIcon className="h-4 w-4" />
          Log out
        </button>
      </header>

      <div className="flex-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="scroll-slim grid min-w-0 auto-cols-fr gap-4 overflow-x-auto pb-2 md:grid-flow-col md:[grid-auto-columns:minmax(240px,1fr)]">
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
        </div>

      {chatOpen ? (
        <div className="fixed bottom-24 right-6 z-40">
          <ChatSidebar
            onBoardUpdate={setBoard}
            onUnauthorized={onLogout}
            onClose={() => setChatOpen(false)}
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setChatOpen((open) => !open)}
        aria-label={chatOpen ? "Hide chat" : "Open chat"}
        aria-expanded={chatOpen}
        className="ring-focus fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--iris)] text-white shadow-2xl transition hover:brightness-115"
      >
        {chatOpen ? (
          <CloseIcon className="h-6 w-6" />
        ) : (
          <ChatIcon className="h-6 w-6" />
        )}
      </button>
    </main>
  );
};
