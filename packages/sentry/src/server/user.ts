import { setUser as setSentryUser, type User } from "@sentry/core";

export type { User };

/**
 * Attaches the logged-in user to every event raised by the current request.
 * Call it once the session resolves, typically from auth middleware.
 *
 * Writes to the per-request scope, so one request's user never reaches another.
 * Pass `null` on logout to clear it.
 */
export function setUser(user: User | null): void {
  setSentryUser(user);
}
