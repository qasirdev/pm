"use client";

import { useState } from "react";
import { login } from "@/lib/auth";

type LoginFormProps = {
  onSuccess: (username: string) => void;
};

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const [username, setUsername] = useState("user");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await login(username, password);
      onSuccess(session.username);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--iris)]/12 ring-1 ring-[var(--iris)]/20">
            <span className="status-dot h-2.5 w-2.5 rounded-full bg-[var(--signal)]" />
          </span>
          <div>
            <p className="eyebrow text-[10px] text-[var(--muted)]">
              Kanban Studio
            </p>
            <p className="text-sm font-medium text-[var(--ink-dim)]">
              Command deck access
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="panel rounded-3xl p-8"
        >
          <div className="signal-rail mb-7 w-16" data-live="true" />
          <h1 className="font-display text-3xl font-semibold text-[var(--ink)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enter your credentials to open the board.
          </p>

          <label className="mt-7 block text-sm font-medium text-[var(--ink-dim)]">
            Username
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="ring-focus mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] transition"
              autoComplete="username"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-[var(--ink-dim)]">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="ring-focus mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] transition"
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <p
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="ring-focus mt-7 w-full rounded-xl bg-[var(--iris)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-115 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
};
