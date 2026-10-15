import { composeApp } from "@acme/app/testing";
import { resetDb, unboundDbEnv } from "@acme/db/testing";
import { createBindings } from "#testing/runtime";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../bindings";
import { getSessionUser } from "./account";
import {
  createSession,
  generateToken,
  hashToken,
  resolveSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./session";
import { seeded } from "./test-utils";

const HOUR_MS = 60 * 60 * 1000;

function createAuthApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.get("/auth", async (ctx) => {
    const user = await getSessionUser(ctx);
    return ctx.json({ user });
  });

  return composeApp(app);
}

describe("createSession", () => {
  beforeEach(() => resetDb());

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
  beforeEach(() => resetDb());

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

describe("getSessionUser", () => {
  beforeEach(() => resetDb());

  it("never touches the db without a cookie", async () => {
    const app = createAuthApp();
    const env = createBindings(unboundDbEnv("DATABASE"));
    const res = await app.request("/auth", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("resolves the cookie to a user", async () => {
    const { env, store } = await seeded();
    const token = await createSession(store, "u1", null, Date.now());
    const app = createAuthApp();

    const authed = await app.request(
      "/auth",
      { headers: { Cookie: `${SESSION_COOKIE}=${token}` } },
      env,
    );
    expect(await authed.json()).toEqual({ user: { id: "u1", name: "Tester" } });

    const bogus = await app.request(
      "/auth",
      { headers: { Cookie: `${SESSION_COOKIE}=forged` } },
      env,
    );
    expect(await bogus.json()).toEqual({ user: null });
  });
});

describe("generateToken", () => {
  it("returns 43 characters of base64url", () => {
    expect(generateToken()).toMatch(/^[\w-]{43}$/u);
  });

  it("never returns the same token twice", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe("hashToken", () => {
  it("returns the sha-256 of its input, in hex", async () => {
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
