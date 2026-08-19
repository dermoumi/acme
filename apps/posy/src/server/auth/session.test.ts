import { resetDb } from "@acme/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { testApp } from "../testing/app";
import config from "virtual:acme-config";
import {
  createSession,
  resolveSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./session";
import { noDatabaseEnv } from "../testing/no-database";
import { seeded } from "./test-utils";
import { hashToken } from "./tokens";

const HOUR_MS = 60 * 60 * 1000;

describe("createSession", () => {
  beforeEach(() => resetDb(config));

  it("stores only the token hash", async () => {
    const { db, store } = await seeded();
    const token = await createSession(store, "u1", "1.0.0", 1000);
    const row = await db
      .selectFrom("sessions")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row.id).toBe(await hashToken(token));
    expect(row.id).not.toBe(token);
    expect(row.client_version).toBe("1.0.0");
  });
});

describe("resolveSession", () => {
  beforeEach(() => resetDb(config));

  it("returns the userId for a valid token", async () => {
    const { store } = await seeded();
    const token = await createSession(store, "u1", null, 1000);
    expect(await resolveSession(store, token, 2000)).toBe("u1");
    expect(await resolveSession(store, "not-a-token", 2000)).toBeNull();
  });

  it("refreshes last_seen_at only after an hour", async () => {
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
  });

  it("rejects an expired session", async () => {
    const { store } = await seeded();
    const token = await createSession(store, "u1", null, 1000);
    const expired = 1000 + SESSION_MAX_AGE_SECONDS * 1000 + 1;
    expect(await resolveSession(store, token, expired)).toBeNull();
  });
});

describe("GET /session", () => {
  beforeEach(() => resetDb(config));

  it("never touches the db without a cookie", async () => {
    const app = testApp();
    const env = noDatabaseEnv();
    const res = await app.request("/session", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("resolves the cookie to a user", async () => {
    const { env, store } = await seeded();
    const token = await createSession(store, "u1", null, Date.now());
    const app = testApp();

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
  });
});
