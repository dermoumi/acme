import type { Kysely } from "kysely";
import type { Database } from "../db";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = "posy_session";
// 400 days: the browser cap on cookie lifetime. Sessions never expire
// server-side; logout is the only revocation.
export const SESSION_MAX_AGE_SECONDS = 34_560_000;

const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  name: string;
}

// The seam future verifiers (password, passkey, OIDC) converge on: verify,
// then call this. Returns the raw token; only its hash is stored.
export async function createSession(
  db: Kysely<Database>,
  userId: string,
  clientVersion: string | null,
  now: number,
): Promise<string> {
  const token = generateToken();
  await db
    .insertInto("sessions")
    .values({
      id: await hashToken(token),
      user_id: userId,
      created_at: now,
      last_seen_at: now,
      client_version: clientVersion,
    })
    .execute();
  return token;
}

export async function resolveSession(
  db: Kysely<Database>,
  token: string,
  now: number,
): Promise<SessionUser | null> {
  const id = await hashToken(token);
  const row = await db
    .selectFrom("sessions")
    .innerJoin("users", "users.id", "sessions.user_id")
    .select(["users.id as user_id", "users.name", "sessions.last_seen_at"])
    .where("sessions.id", "=", id)
    .executeTakeFirst();
  if (!row) return null;
  if (now - row.last_seen_at > LAST_SEEN_REFRESH_MS) {
    await db
      .updateTable("sessions")
      .set({ last_seen_at: now })
      .where("id", "=", id)
      .execute();
  }
  return { id: row.user_id, name: row.name };
}
