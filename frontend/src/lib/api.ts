import type { BoardData, Card, Column } from "@/lib/kanban";

class ApiError extends Error {
  constructor(public status: number) {
    super(`API request failed with status ${status}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export { ApiError };

export function fetchBoard(): Promise<BoardData> {
  return request("/api/board");
}

export function renameColumn(columnId: string, title: string): Promise<Column> {
  return request(`/api/columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function createCard(
  columnId: string,
  title: string,
  details: string
): Promise<Card> {
  return request("/api/cards", {
    method: "POST",
    body: JSON.stringify({ column_id: columnId, title, details }),
  });
}

export function moveCardApi(cardId: string, columnId: string): Promise<Card> {
  return request(`/api/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({ column_id: columnId }),
  });
}

export function deleteCardApi(cardId: string): Promise<void> {
  return request(`/api/cards/${cardId}`, { method: "DELETE" });
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatResponse = {
  reply: string;
  board: BoardData;
};

export function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  return request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}
