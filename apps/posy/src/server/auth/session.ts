import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = "posy_session";
// 400 days: the browser cap on cookie lifetime.
export const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

const SESSION_IDLE_MS = SESSION_MAX_AGE_SECONDS * 1000;
const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  name: string;
}

export interface SessionStore {
  create(
    id: string,
    userId: string,
    clientVersion: string | null,
    now: number,
  ): Promise<void>;
  get(id: string): Promise<{ userId: string; lastSeenAt: number } | null>;
  touch(id: string, now: number): Promise<void>;
  revoke(id: string): Promise<void>;
}

export async function createSession(
  store: SessionStore,
  userId: string,
  clientVersion: string | null,
  now: number,
): Promise<string> {
  const token = generateToken();
  await store.create(await hashToken(token), userId, clientVersion, now);
  return token;
}

export async function resolveSession(
  store: SessionStore,
  token: string,
  now: number,
): Promise<string | null> {
  const id = await hashToken(token);
  const session = await store.get(id);
  if (!session) return null;
  if (now - session.lastSeenAt > SESSION_IDLE_MS) return null;
  if (now - session.lastSeenAt > LAST_SEEN_REFRESH_MS) {
    await store.touch(id, now);
  }
  return session.userId;
}

export async function revokeSession(
  store: SessionStore,
  token: string,
): Promise<void> {
  await store.revoke(await hashToken(token));
}
