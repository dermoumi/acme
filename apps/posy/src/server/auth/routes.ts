import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Dialect } from "kysely";
import type { AppBindings } from "../bindings";
import { createDb } from "../db";
import { verifyPassword } from "./password";
import {
  resolveSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./session";
import { hashToken } from "./tokens";

interface LoginBody {
  username: string | null;
  password: string | null;
  clientVersion: string | null;
}

function parseLoginBody(body: unknown): LoginBody {
  if (typeof body !== "object" || body === null) {
    return { username: null, password: null, clientVersion: null };
  }
  const record = body as Record<string, unknown>;
  return {
    username:
      typeof record.username === "string" && record.username
        ? record.username
        : null,
    password:
      typeof record.password === "string" && record.password
        ? record.password
        : null,
    clientVersion:
      typeof record.clientVersion === "string" ? record.clientVersion : null,
  };
}

type Ctx = Context<{ Bindings: AppBindings }>;

async function handleLogin(
  ctx: Ctx,
  getDialect: (env: AppBindings) => Dialect,
): Promise<Response> {
  const { username, password, clientVersion } = parseLoginBody(
    await ctx.req.json().catch(() => null),
  );
  if (!username || !password) {
    return ctx.json({ error: "invalid_credentials" }, 401);
  }

  const db = createDb(getDialect(ctx.env));
  const user = await verifyPassword(
    db,
    username,
    password,
    clientVersion,
    Date.now(),
  );
  if (!user) return ctx.json({ error: "invalid_credentials" }, 401);

  setCookie(ctx, SESSION_COOKIE, user.token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return ctx.json({ user: { id: user.id, name: user.name } });
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

  routes.post("/", (ctx) => handleLogin(ctx, getDialect));

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
