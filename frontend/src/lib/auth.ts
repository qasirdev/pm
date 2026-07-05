export type SessionResponse = { username: string };

export async function fetchSession(): Promise<SessionResponse | null> {
  const response = await fetch("/api/session", { credentials: "include" });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export async function login(
  username: string,
  password: string
): Promise<SessionResponse> {
  const response = await fetch("/api/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error("Invalid username or password.");
  }
  return response.json();
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
}
