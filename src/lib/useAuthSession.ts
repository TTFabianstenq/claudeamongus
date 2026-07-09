"use client";

import { useCallback, useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface SessionResponse {
  user?: AuthUser;
}

/**
 * Minimal session hook (no SessionProvider needed): reads the Auth.js
 * session endpoint and exposes a refresh function for after sign-in/out.
 */
export function useAuthSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = (await res.json()) as SessionResponse | null;
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, loading, refresh };
}
