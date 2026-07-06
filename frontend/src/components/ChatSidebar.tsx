"use client";

import { useState } from "react";
import { ApiError, sendChatMessage, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";
import { ChatIcon, SendIcon } from "@/components/icons";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
  onUnauthorized: () => void;
};

export const ChatSidebar = ({
  onBoardUpdate,
  onUnauthorized,
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
    <aside className="flex min-h-[520px] w-full flex-col gap-4 rounded-3xl border border-[var(--stroke)] bg-white/80 p-6 shadow-[var(--shadow)] backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--secondary-purple)]/10 text-[var(--secondary-purple)]">
          <ChatIcon className="h-4 w-4" />
        </span>
        <h2 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
          Board Chat
        </h2>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Ask me to create, edit, move, or delete cards, or rename columns.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-6 rounded-2xl bg-[var(--secondary-purple)] px-4 py-2 text-sm text-white"
                  : "mr-6 rounded-2xl bg-[var(--surface)] px-4 py-2 text-sm text-[var(--navy-dark)]"
              }
            >
              {message.content}
            </div>
          ))
        )}
        {sending ? (
          <div className="mr-6 rounded-2xl bg-[var(--surface)] px-4 py-2 text-sm text-[var(--gray-text)]">
            Thinking...
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask the assistant..."
          className="flex-1 rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] focus:border-[var(--primary-blue)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send message"
          className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--secondary-purple)] px-3 py-2 text-white transition-opacity disabled:opacity-60"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
};
