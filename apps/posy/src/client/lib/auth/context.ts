import { createContext, useContext } from "react";
import type { SessionUser } from "./api";

export type AuthStatus = "unknown" | "guest" | "authed";

export interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
  login: (username: string, password: string) => Promise<boolean>;
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
