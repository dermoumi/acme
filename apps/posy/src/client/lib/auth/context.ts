import { createContext, useContext } from "react";

export type AuthStatus = "unknown" | "guest" | "authed";

export interface AuthState {
  status: AuthStatus;
  login: () => void;
}

export const AuthContext = createContext<AuthState>({
  status: "unknown",
  login: () => undefined,
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
