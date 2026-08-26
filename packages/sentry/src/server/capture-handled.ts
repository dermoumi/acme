import { captureException, withScope, type User } from "@sentry/core";
import type { Context } from "hono";

/**
 * Extra detail to attach to a single `captureHandledError` call.
 *
 * Applies to that event only: it is set on a child scope, so nothing here
 * reaches the rest of the request. The url and method are added for you.
 */
export interface HandledErrorContext {
  /**
   * Overrides the user set for the request, if any.
   */
  user?: User;
  /**
   * Arbitrary detail shown on the event. Not searchable; use tags for that.
   */
  extras?: Record<string, unknown>;
  /**
   * Indexed by Sentry, so events can be searched and grouped by these.
   */
  tags?: Record<string, string | number | boolean>;
}

/**
 * Reports an error the route is deliberately swallowing, such as a cache read
 * that falls back to the database. The request still succeeds.
 *
 * Unlike a thrown error this never reaches `onError`, so nothing else will
 * report it. Returns the event id, or undefined when no client is configured.
 */
export function captureHandledError(
  ctx: Context,
  error: unknown,
  context: HandledErrorContext = {},
): string | undefined {
  return withScope((scope) => {
    if (context.user) scope.setUser(context.user);
    scope.setExtra("url", ctx.req.url);
    scope.setExtra("method", ctx.req.method);
    if (context.extras) scope.setExtras(context.extras);
    if (context.tags) scope.setTags(context.tags);
    return captureException(error);
  });
}
