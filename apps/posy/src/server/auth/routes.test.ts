import type { Hono } from "hono";
import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { createApp } from "../app";
import type { AppBindings } from "../bindings";
import { createDb, type Database } from "../db";
import { mintPairingLink, PAIRING_LINK_TTL_MS } from "./pairing";
import { SESSION_COOKIE } from "./session";
import { migratedDialect, seedUser, testEnv } from "./test-utils";
import { generateToken, hashToken } from "./tokens";

type App = Hono<{ Bindings: AppBindings }>;

const HOUR_MS = 60 * 60 * 1000;

async function appWithUser(): Promise<{ app: App; db: Kysely<Database> }> {
  const dialect = await migratedDialect();
  const db = createDb(dialect);
  await seedUser(db, "u1");
  return { app: createApp(() => dialect), db };
}

async function mintCode(
  db: Kysely<Database>,
  overrides: { expires_at?: number; used_at?: number | null } = {},
): Promise<string> {
  const code = generateToken();
  await db
    .insertInto("pairing_links")
    .values({
      token_hash: await hashToken(code),
      user_id: "u1",
      created_at: Date.now(),
      expires_at: Date.now() + HOUR_MS,
      used_at: null,
      ...overrides,
    })
    .execute();
  return code;
}

async function login(app: App, body: unknown): Promise<Response> {
  return app.request(
    "/session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    testEnv,
  );
}

function cookieOf(res: Response): string {
  const header = res.headers.get("set-cookie") ?? "";
  const match = /posy_session=([^;]*)/u.exec(header);
  if (!match) throw new Error("no session cookie in response");
  return `${SESSION_COOKIE}=${match[1]}`;
}

async function getSession(app: App, cookie?: string): Promise<Response> {
  return app.request(
    "/session",
    cookie ? { headers: { Cookie: cookie } } : {},
    testEnv,
  );
}

test("mint, redeem, authed: the happy path", async () => {
  const { app, db } = await appWithUser();
  const code = await mintCode(db);

  const res = await login(app, { code, clientVersion: "1.2.3" });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ user: { id: "u1", name: "Tester" } });

  const header = res.headers.get("set-cookie") ?? "";
  expect(header).toContain("HttpOnly");
  expect(header).toContain("Secure");
  expect(header).toContain("SameSite=Strict");
  expect(header).toContain("Max-Age=34560000");
  expect(header).toContain("Path=/");

  const whoami = await getSession(app, cookieOf(res));
  expect(await whoami.json()).toEqual({ user: { id: "u1", name: "Tester" } });

  const link = await db
    .selectFrom("pairing_links")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(link.used_at).not.toBeNull();
  const session = await db
    .selectFrom("sessions")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(session.client_version).toBe("1.2.3");
  await db.destroy();
});

test("missing, malformed, unknown, used, and expired codes get identical 401s", async () => {
  const { app, db } = await appWithUser();
  const used = await mintCode(db, { used_at: Date.now() });
  const expired = await mintCode(db, { expires_at: Date.now() - 1 });

  const attempts = await Promise.all([
    login(app, {}),
    login(app, "not an object"),
    login(app, { code: generateToken() }),
    login(app, { code: used }),
    login(app, { code: expired }),
  ]);
  const bodies = await Promise.all(attempts.map((res) => res.json()));
  for (const res of attempts) {
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  }
  for (const body of bodies) {
    expect(body).toEqual({ error: "invalid_code" });
  }
  await db.destroy();
});

test("mintPairingLink mints a redeemable 7-day link", async () => {
  const { app, db } = await appWithUser();
  const now = Date.now();
  const code = await mintPairingLink(db, "u1", now);
  const link = await db
    .selectFrom("pairing_links")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(link.expires_at).toBe(now + PAIRING_LINK_TTL_MS);
  expect((await login(app, { code })).status).toBe(200);
  await db.destroy();
});

test("minting purges expired links but keeps used and live ones", async () => {
  const { app, db } = await appWithUser();
  const now = Date.now();
  await mintCode(db, { expires_at: now - 1 });
  const used = await mintCode(db, { used_at: now });
  const live = await mintCode(db);

  await mintPairingLink(db, "u1", now);
  const remaining = await db
    .selectFrom("pairing_links")
    .select("token_hash")
    .execute();
  const hashes = new Set(remaining.map((row) => row.token_hash));
  expect(hashes.size).toBe(3);
  expect(hashes).toContain(await hashToken(used));
  expect(hashes).toContain(await hashToken(live));
  expect((await login(app, { code: live })).status).toBe(200);
  await db.destroy();
});

test("a code is single-use", async () => {
  const { app, db } = await appWithUser();
  const code = await mintCode(db);
  expect((await login(app, { code })).status).toBe(200);
  expect((await login(app, { code })).status).toBe(401);
  await db.destroy();
});

test("sessions survive a worker restart", async () => {
  const dialect = await migratedDialect();
  const db = createDb(dialect);
  await seedUser(db, "u1");
  const cookie = cookieOf(
    await login(
      createApp(() => dialect),
      { code: await mintCode(db) },
    ),
  );

  const rebooted = createApp(() => dialect);
  const res = await getSession(rebooted, cookie);
  expect(await res.json()).toEqual({ user: { id: "u1", name: "Tester" } });
  await db.destroy();
});

test("logout revokes only the current device's session", async () => {
  const { app, db } = await appWithUser();
  const phone = cookieOf(await login(app, { code: await mintCode(db) }));
  const tablet = cookieOf(await login(app, { code: await mintCode(db) }));

  const res = await app.request(
    "/session",
    { method: "DELETE", headers: { Cookie: phone } },
    testEnv,
  );
  expect(res.status).toBe(204);
  expect(res.headers.get("set-cookie")).toContain("Max-Age=0");

  expect(await (await getSession(app, phone)).json()).toEqual({ user: null });
  expect(await (await getSession(app, tablet)).json()).toEqual({
    user: { id: "u1", name: "Tester" },
  });
  await db.destroy();
});

test("logout without a session is a 204 no-op", async () => {
  const { app, db } = await appWithUser();
  const res = await app.request("/session", { method: "DELETE" }, testEnv);
  expect(res.status).toBe(204);
  await db.destroy();
});

test("the db only ever holds sha-256 hashes, never raw tokens", async () => {
  const { app, db } = await appWithUser();
  const code = await mintCode(db);
  const cookie = cookieOf(await login(app, { code }));
  const rawToken = cookie.split("=")[1];

  const links = await db.selectFrom("pairing_links").selectAll().execute();
  const sessions = await db.selectFrom("sessions").selectAll().execute();
  for (const stored of [
    ...links.map((row) => row.token_hash),
    ...sessions.map((row) => row.id),
  ]) {
    expect(stored).toMatch(/^[0-9a-f]{64}$/u);
    expect(stored).not.toBe(code);
    expect(stored).not.toBe(rawToken);
  }
  await db.destroy();
});
