import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { createApp } from "../app";
import { createDb } from "@acme/db";
import type { Database } from "../db";
import {
  createSession,
  resolveSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./session";
import { DbSessionStore } from "./session-db";
import { noDatabase } from "../testing/no-database";
import { migratedDialect, seedUser, testEnv as env } from "./test-utils";
import { hashToken } from "./tokens";

const HOUR_MS = 60 * 60 * 1000;

async function seeded(): Promise<{
  db: Kysely<Database>;
  store: DbSessionStore;
}> {
  const db = createDb<Database>(await migratedDialect());
  await seedUser(db, "u1");
  return { db, store: new DbSessionStore(db) };
}

test("createSession stores only the token hash", async () => {
  const { db, store } = await seeded();
  const token = await createSession(store, "u1", "1.0.0", 1000);
  const row = await db
    .selectFrom("sessions")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(row.id).toBe(await hashToken(token));
  expect(row.id).not.toBe(token);
  expect(row.client_version).toBe("1.0.0");
  await db.destroy();
});

test("resolveSession returns the userId for a valid token", async () => {
  const { db, store } = await seeded();
  const token = await createSession(store, "u1", null, 1000);
  expect(await resolveSession(store, token, 2000)).toBe("u1");
  expect(await resolveSession(store, "not-a-token", 2000)).toBeNull();
  await db.destroy();
});

test("resolveSession refreshes last_seen_at only after an hour", async () => {
  const { db, store } = await seeded();
  const token = await createSession(store, "u1", null, 1000);
  const lastSeen = async () => {
    return (
      await db
        .selectFrom("sessions")
        .select("last_seen_at")
        .executeTakeFirstOrThrow()
    ).last_seen_at;
  };

  await resolveSession(store, token, 1000 + HOUR_MS);
  expect(await lastSeen()).toBe(1000);
  await resolveSession(store, token, 1000 + 2 * HOUR_MS);
  expect(await lastSeen()).toBe(1000 + 2 * HOUR_MS);
  await db.destroy();
});

test("resolveSession rejects expired sessions", async () => {
  const { db, store } = await seeded();
  const token = await createSession(store, "u1", null, 1000);
  const expired = 1000 + SESSION_MAX_AGE_SECONDS * 1000 + 1;
  expect(await resolveSession(store, token, expired)).toBeNull();
  await db.destroy();
});

test("GET /session without a cookie never touches the db", async () => {
  const app = createApp({ database: noDatabase });
  const res = await app.request("/session", {}, env);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ user: null });
});

test("GET /session resolves the cookie to a user", async () => {
  const dialect = await migratedDialect();
  const db = createDb<Database>(dialect);
  await seedUser(db, "u1");
  const store = new DbSessionStore(db);
  const token = await createSession(store, "u1", null, Date.now());
  const app = createApp({ database: { dialect } });

  const authed = await app.request(
    "/session",
    { headers: { Cookie: `${SESSION_COOKIE}=${token}` } },
    env,
  );
  expect(await authed.json()).toEqual({ user: { id: "u1", name: "Tester" } });

  const bogus = await app.request(
    "/session",
    { headers: { Cookie: `${SESSION_COOKIE}=forged` } },
    env,
  );
  expect(await bogus.json()).toEqual({ user: null });
  await db.destroy();
});
