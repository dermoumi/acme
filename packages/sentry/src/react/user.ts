import { setUser as setSentryUser, type User } from "@sentry/react";

export type { User };

/**
 * Attaches the logged-in user to every event the browser reports from now on.
 * Call it when the session resolves, and with `null` on logout.
 *
 * The value is set client-side, so treat it as a debugging aid rather than
 * proof of identity. Server events carry their own user, set from the session.
 */
export function setUser(user: User | null): void {
  setSentryUser(user);
}
