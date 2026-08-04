import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import type { Kysely } from "kysely";
import type { DbSource } from "../source";

/**
 * The context variables {@link dbMiddleware} sets.
 *
 * Put it on a router's `Variables` to read `ctx.var.db` with the app's schema:
 * `new Hono<{ Bindings: AppBindings; Variables: DbVariables<Database> }>()`.
 */
export interface DbVariables<DB> {
  db: Kysely<DB>;
}

/**
 * Resolves the database once per request and puts it on the context.
 *
 * Mount it only on the routes that query, not app-wide: on node the first
 * request through it opens the connection, and a route serving static assets
 * has no reason to pay for one.
 *
 * Takes the source rather than hanging off it, so `createDbSource` stays free of Hono
 * and this import cost falls only on apps that mount middleware.
 */
export function dbMiddleware<DB>(
  source: DbSource<DB>,
): MiddlewareHandler<{ Variables: DbVariables<DB> }> {
  return createMiddleware<{ Variables: DbVariables<DB> }>(async (ctx, next) => {
    ctx.set("db", await source.resolve(ctx.env));
    await next();
  });
}
