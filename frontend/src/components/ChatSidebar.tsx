"use client";

import { useState } from "react";
import { ApiError, sendChatMessage, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";
import { ChatIcon, CloseIcon, SendIcon } from "@/components/icons";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
  onUnauthorized: () => void;
  onClose: () => void;
};

export const ChatSidebar = ({
  onBoardUpdate,
  onUnauthorized,
  onClose,
}: ChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) {
      return;
    }

    const history = messages;
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages([...history, userMessage]);
    setInput("");
    setError(null);
    setSending(true);

    try {
      const response = await sendChatMessage(trimmed, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.reply },
      ]);
      onBoardUpdate(response.board);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="panel flex h-[540px] max-h-[calc(100vh-8rem)] w-[360px] max-w-[calc(100vw-3rem)] flex-col gap-4 rounded-3xl p-5 shadow-2xl">
      <div className="signal-rail w-full" data-live={sending} />
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--iris)]/12 text-[var(--iris)] ring-1 ring-[var(--iris)]/20">
          <ChatIcon className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold leading-tight text-[var(--ink)]">
            Board Chat
          </h2>
          <p className="eyebrow text-[10px] text-[var(--muted)]">
            AI co-pilot
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="ring-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--canvas-2)] hover:text-[var(--ink)]"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="scroll-slim flex-1 space-y-3 overflow-y-auto pr-0.5">
        {messages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            Ask me to create, edit, move, or delete cards, or rename columns.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-5 rounded-2xl rounded-br-md bg-[var(--iris)] px-4 py-2.5 text-sm text-white"
                  : "mr-5 rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--canvas-2)] px-4 py-2.5 text-sm text-[var(--ink-dim)]"
              }
            >
              {message.content}
            </div>
          ))
        )}
        {sending ? (
          <div className="mr-5 flex items-center gap-2 rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--canvas-2)] px-4 py-2.5 text-sm text-[var(--muted)]">
            <span className="status-dot h-1.5 w-1.5 rounded-full bg-[var(--signal)]" />
            Thinking...
          </div>
        ) : null}
      </div>

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask the assistant..."
          className="ring-focus flex-1 rounded-xl border border-[var(--line)] bg-[var(--field)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] outline-none transition"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send message"
          className="ring-focus flex shrink-0 items-center justify-center rounded-xl bg-[var(--iris)] px-3.5 py-2.5 text-white transition hover:brightness-115 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
};
