import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Dialect } from "kysely";
import type { AppBindings } from "../bindings";
import { createDb } from "../db";
import { resolveSession, SESSION_COOKIE } from "./session";

export function authRoutes(
  getDialect: (env: AppBindings) => Dialect,
): Hono<{ Bindings: AppBindings }> {
  const routes = new Hono<{ Bindings: AppBindings }>();

  routes.get("/", async (ctx) => {
    const token = getCookie(ctx, SESSION_COOKIE);
    if (!token) return ctx.json({ user: null });
    const db = createDb(getDialect(ctx.env));
    const user = await resolveSession(db, token, Date.now());
    return ctx.json({ user });
  });

  return routes;
}
