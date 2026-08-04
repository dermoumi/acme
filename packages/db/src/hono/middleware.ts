import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import type { Kysely } from "kysely";
import type { DbSource } from "../internal/source";

/**
 * The context variables {@link dbMiddleware} sets.
 *
 * Put it on a router's `Variables` to call `ctx.var.db()` with the app's schema:
 * `new Hono<{ Bindings: AppBindings; Variables: DbVariables<Database> }>()`.
 */
export interface DbVariables<DB> {
  /** The request's database, resolved on the first call and reused after it. */
  db: () => Promise<Kysely<DB>>;
}

/**
 * Puts a lazy handle on the request's database.
 *
 * Nothing resolves until a handler calls `ctx.var.db()`, so mounting this
 * app-wide costs a closure, and a route that never queries never opens a
 * connection. The answer is memoised per request, so asking twice is free.
 *
 * Takes the source rather than hanging off it, so `createDbSource` stays free
 * of Hono and only apps mounting middleware pay for the import.
 */
export function dbMiddleware<DB>(
  source: DbSource<DB>,
): MiddlewareHandler<{ Variables: DbVariables<DB> }> {
  return createMiddleware<{ Variables: DbVariables<DB> }>(async (ctx, next) => {
    let pending: Promise<Kysely<DB>> | undefined;
    ctx.set("db", () => (pending ??= source.resolve(ctx.env)));
    await next();
  });
}
