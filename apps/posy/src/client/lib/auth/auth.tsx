import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Redirect } from "wouter";
import {
  endSession,
  fetchSession,
  loginWithPassword,
  type SessionUser,
} from "./api";
import { AuthContext, useAuth, type AuthStatus } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("unknown");
  const [user, setUser] = useState<SessionUser | null>(null);

  const adopt = useCallback((next: SessionUser | null) => {
    setUser(next);
    setStatus(next ? "authed" : "guest");
  }, []);

  useEffect(() => {
    let active = true;
    void fetchSession()
      .catch(() => null)
      .then((current) => {
        if (active) adopt(current);
      });
    return () => {
      active = false;
    };
  }, [adopt]);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await loginWithPassword(
        username,
        password,
        import.meta.env.VITE_APP_VERSION,
      );
      if (result) adopt(result);
      return result !== null;
    },
    [adopt],
  );

  const logout = useCallback(async () => {
    await endSession().catch(() => undefined);
    adopt(null);
  }, [adopt]);

  const value = useMemo(
    () => ({ status, user, login, logout }),
    [status, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function RequireAuth({ children }: { children: ReactNode }): ReactNode {
  const { status } = useAuth();

  if (status === "unknown") return null;
  if (status === "guest") return <Redirect replace to="/login" />;
  return children;
}
