"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { fetchSession } from "@/lib/auth";

export default function Home() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetchSession().then((session) => {
      setLoggedIn(session !== null);
      setCheckingSession(false);
    });
  }, []);

  if (checkingSession) {
    return null;
  }

  if (!loggedIn) {
    return <LoginForm onSuccess={() => setLoggedIn(true)} />;
  }

  return <KanbanBoard onLogout={() => setLoggedIn(false)} />;
}
