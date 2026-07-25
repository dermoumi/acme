import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { createApp } from "../app";
import { createDb, type Database } from "../db";
import { createSession, resolveSession, SESSION_COOKIE } from "./session";
import { migratedDialect, seedUser, testEnv as env } from "./test-utils";
import { hashToken } from "./tokens";

const HOUR_MS = 60 * 60 * 1000;

async function seededDb(): Promise<Kysely<Database>> {
  const db = createDb(await migratedDialect());
  await seedUser(db, "u1");
  return db;
}

test("createSession stores only the token hash", async () => {
  const db = await seededDb();
  const token = await createSession(db, "u1", "1.0.0", 1000);
  const row = await db
    .selectFrom("sessions")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(row.id).toBe(await hashToken(token));
  expect(row.id).not.toBe(token);
  expect(row.client_version).toBe("1.0.0");
  await db.destroy();
});

test("resolveSession returns the user for a valid token", async () => {
  const db = await seededDb();
  const token = await createSession(db, "u1", null, 1000);
  expect(await resolveSession(db, token, 2000)).toEqual({
    id: "u1",
    name: "Tester",
  });
  expect(await resolveSession(db, "not-a-token", 2000)).toBeNull();
  await db.destroy();
});

test("resolveSession refreshes last_seen_at only after an hour", async () => {
  const db = await seededDb();
  const token = await createSession(db, "u1", null, 1000);
  const lastSeen = async () =>
    (
      await db
        .selectFrom("sessions")
        .select("last_seen_at")
        .executeTakeFirstOrThrow()
    ).last_seen_at;

  await resolveSession(db, token, 1000 + HOUR_MS);
  expect(await lastSeen()).toBe(1000);
  await resolveSession(db, token, 1000 + 2 * HOUR_MS);
  expect(await lastSeen()).toBe(1000 + 2 * HOUR_MS);
  await db.destroy();
});

test("GET /session without a cookie never touches the db", async () => {
  const app = createApp(() => {
    throw new Error("getDialect must not be called");
  });
  const res = await app.request("/session", {}, env);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ user: null });
});

test("GET /session resolves the cookie to a user", async () => {
  const dialect = await migratedDialect();
  const db = createDb(dialect);
  await seedUser(db, "u1");
  const token = await createSession(db, "u1", null, 1000);
  const app = createApp(() => dialect);

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
