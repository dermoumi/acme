import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Dialect } from "kysely";
import type { AppBindings } from "../bindings";
import { createDb } from "../db";
import { redeemLink } from "./pairing";
import {
  resolveSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./session";
import { hashToken } from "./tokens";

interface LoginBody {
  code: string | null;
  clientVersion: string | null;
}

function parseLoginBody(body: unknown): LoginBody {
  if (typeof body !== "object" || body === null) {
    return { code: null, clientVersion: null };
  }
  const record = body as Record<string, unknown>;
  return {
    code: typeof record.code === "string" && record.code ? record.code : null,
    clientVersion:
      typeof record.clientVersion === "string" ? record.clientVersion : null,
  };
}

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

  routes.post("/", async (ctx) => {
    const { code, clientVersion } = parseLoginBody(
      await ctx.req.json().catch(() => null),
    );
    if (!code) return ctx.json({ error: "invalid_code" }, 401);

    const db = createDb(getDialect(ctx.env));
    const now = Date.now();
    const user = await redeemLink(db, code, clientVersion, now);
    if (!user) return ctx.json({ error: "invalid_code" }, 401);

    setCookie(ctx, SESSION_COOKIE, user.token, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return ctx.json({ user: { id: user.id, name: user.name } });
  });

  routes.delete("/", async (ctx) => {
    const token = getCookie(ctx, SESSION_COOKIE);
    if (token) {
      const db = createDb(getDialect(ctx.env));
      await db
        .deleteFrom("sessions")
        .where("id", "=", await hashToken(token))
        .execute();
    }
    deleteCookie(ctx, SESSION_COOKIE, { path: "/" });
    return ctx.body(null, 204);
  });

  return routes;
}
