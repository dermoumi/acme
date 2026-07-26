import type { Kysely } from "kysely";
import type { Database } from "../db";
import { createSession, type SessionUser } from "./session";
import { generateToken, hashToken } from "./tokens";

export const PAIRING_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Returns the raw single-use code; only its hash is stored. Minting is rare, so
// it doubles as the sweep for expired links (used rows stay as audit trail).
export async function mintPairingLink(
  db: Kysely<Database>,
  userId: string,
  now: number,
): Promise<string> {
  await db
    .deleteFrom("pairing_links")
    .where("used_at", "is", null)
    .where("expires_at", "<=", now)
    .execute();

  const code = generateToken();
  await db
    .insertInto("pairing_links")
    .values({
      token_hash: await hashToken(code),
      user_id: userId,
      created_at: now,
      expires_at: now + PAIRING_LINK_TTL_MS,
      used_at: null,
    })
    .execute();
  return code;
}

// Conditional update + returning makes redemption atomic: missing, used,
// and expired codes all fall through to the same null.
export async function redeemLink(
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
