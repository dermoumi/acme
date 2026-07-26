import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Redirect } from "wouter";
import { endSession, fetchSession, redeemCode, type SessionUser } from "./api";
import { AuthContext, useAuth, type AuthStatus } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("unknown");
  const [user, setUser] = useState<SessionUser | null>(null);

  const settled = useRef(false);

  const adopt = useCallback((next: SessionUser | null) => {
    settled.current = true;
    setUser(next);
    setStatus(next ? "authed" : "guest");
  }, []);

  // A pairing link redeems while this is in flight; never clobber that result.
  useEffect(() => {
    let active = true;
    void fetchSession()
      .catch(() => null)
      .then((current) => {
        if (active && !settled.current) adopt(current);
      });
    return () => {
      active = false;
    };
  }, [adopt]);

  const login = useCallback(
    async (code: string) => {
      const paired = await redeemCode(code, import.meta.env.VITE_APP_VERSION);
      if (paired) adopt(paired);
      return paired !== null;
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
