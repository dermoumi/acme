import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../bindings";
import { verifyPassword } from "./password";
import { DbSessionStore } from "./session-db";
import {
  createSession,
  resolveSession,
  revokeSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./session";

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

type Ctx = Context<AppEnv>;

async function handleLogin(ctx: Ctx): Promise<Response> {
  const { username, password, clientVersion } = parseLoginBody(
    await ctx.req.json().catch(() => null),
  );
  if (!username || !password) {
    return ctx.json({ error: "invalid_credentials" }, 401);
  }

  const db = await ctx.var.getDb("DATABASE");
  const user = await verifyPassword(db, username, password);
  if (!user) return ctx.json({ error: "invalid_credentials" }, 401);

  const store = new DbSessionStore(db);
  const token = await createSession(store, user.id, clientVersion, Date.now());

  setCookie(ctx, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return ctx.json({ user: { id: user.id, name: user.name } });
}

export function authRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get("/", async (ctx) => {
    const token = getCookie(ctx, SESSION_COOKIE);
    if (!token) return ctx.json({ user: null });
    const db = await ctx.var.getDb("DATABASE");
    const store = new DbSessionStore(db);
    const userId = await resolveSession(store, token, Date.now());
    if (!userId) return ctx.json({ user: null });
    const user = await db
      .selectFrom("users")
      .select(["id", "name"])
      .where("id", "=", userId)
      .executeTakeFirst();
    return ctx.json({ user: user ?? null });
  });

  routes.post("/", (ctx) => handleLogin(ctx));

  routes.delete("/", async (ctx) => {
    const token = getCookie(ctx, SESSION_COOKIE);
    if (token) {
      const db = await ctx.var.getDb("DATABASE");

      await revokeSession(new DbSessionStore(db), token);
    }
    deleteCookie(ctx, SESSION_COOKIE, { path: "/" });
    return ctx.body(null, 204);
  });

  return routes;
}
