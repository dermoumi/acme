import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { serialize } from "hono/utils/cookie";
import type { AppEnv } from "../bindings";
import { verifyPassword } from "./password";
import { DbSessionStore } from "./session-db";
import {
  createSession,
  resolveSession,
  revokeSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type SessionUser,
} from "./session";

export async function getSessionUser(
  ctx: Context<AppEnv>,
): Promise<SessionUser | null> {
  const token = getCookie(ctx, SESSION_COOKIE);
  if (!token) return null;

  const db = await ctx.var.getDb("DATABASE");
  const userId = await resolveSession(
    new DbSessionStore(db),
    token,
    Date.now(),
  );
  if (!userId) return null;

  const user = await db
    .selectFrom("users")
    .select(["id", "name"])
    .where("id", "=", userId)
    .executeTakeFirst();
  return user ?? null;
}

export async function signIn(
  ctx: Context<AppEnv>,
  username: string,
  password: string,
  clientVersion: string | null,
): Promise<{ user: SessionUser; cookie: string } | null> {
  const db = await ctx.var.getDb("DATABASE");
  const user = await verifyPassword(db, username, password);
  if (!user) return null;

  const store = new DbSessionStore(db);
  const token = await createSession(store, user.id, clientVersion, Date.now());
  const cookie = serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { user: { id: user.id, name: user.name }, cookie };
}

export async function signOut(ctx: Context<AppEnv>): Promise<string> {
  const token = getCookie(ctx, SESSION_COOKIE);
  if (token) {
    const db = await ctx.var.getDb("DATABASE");

    await revokeSession(new DbSessionStore(db), token);
  }

  return serialize(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}
