import { setUser as setSentryUser, type User } from "@sentry/core";

export type { User };

/**
 * Attaches the logged-in user to every event raised by the current request.
 * Call it once the session resolves, typically from auth middleware.
 *
 * ```ts
 * app.use(async (ctx, next) => {
 *   const user = await resolveSession(ctx);
 *   if (user) setUser({ id: user.id, username: user.name });
 *   await next();
 * });
 * ```
 *
 * Writes to the per-request scope, so one request's user never reaches another.
 * Pass `null` on logout to clear it.
 *
 * Ignored under `masking: "full"`, where user data is stripped before sending.
 */
export function setUser(user: User | null): void {
  setSentryUser(user);
}
