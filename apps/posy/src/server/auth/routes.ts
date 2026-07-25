import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Dialect, Kysely } from "kysely";
import type { AppBindings } from "../bindings";
import { createDb, type Database } from "../db";
import {
  createSession,
  resolveSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type SessionUser,
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

// Conditional update + returning makes redemption atomic: missing, used,
// and expired codes all fall through to the same null.
async function redeemLink(
  db: Kysely<Database>,
  code: string,
  clientVersion: string | null,
  now: number,
): Promise<(SessionUser & { token: string }) | null> {
  const link = await db
    .updateTable("pairing_links")
    .set({ used_at: now })
    .where("token_hash", "=", await hashToken(code))
    .where("used_at", "is", null)
    .where("expires_at", ">", now)
    .returning("user_id")
    .executeTakeFirst();
  if (!link) return null;

  const token = await createSession(db, link.user_id, clientVersion, now);
  const user = await db
    .selectFrom("users")
    .select(["id", "name"])
    .where("id", "=", link.user_id)
    .executeTakeFirstOrThrow();
  return { ...user, token };
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
