import { createContext, useContext } from "react";
import type { SessionUser } from "./api";

export type AuthStatus = "unknown" | "guest" | "authed";

export interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
  // Resolves false when the code was rejected; rejects on network failure.
  login: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  status: "unknown",
  user: null,
  login: () => Promise.resolve(false),
  logout: () => Promise.resolve(),
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
