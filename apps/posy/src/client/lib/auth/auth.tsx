import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Redirect } from "wouter";
import { AuthContext, useAuth, type AuthStatus } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  // Stub: fake sign-in only. Auth task replaces this with real pairing + GET /session.
  const [status, setStatus] = useState<AuthStatus>("guest");
  const value = useMemo(
    () => ({
      status,
      login: () => {
        setStatus("authed");
      },
    }),
    [status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function RequireAuth({ children }: { children: ReactNode }): ReactNode {
  const { status } = useAuth();

  if (status === "unknown") return null;
  if (status === "guest") return <Redirect replace to="/login" />;
  return children;
}
