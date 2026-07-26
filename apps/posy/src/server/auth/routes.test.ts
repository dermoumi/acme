import type { Hono } from "hono";
import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { createApp } from "../app";
import type { AppBindings } from "../bindings";
import { createDb, type Database } from "../db";
import { SESSION_COOKIE } from "./session";
import { migratedDialect, seedUser, testEnv } from "./test-utils";

type App = Hono<{ Bindings: AppBindings }>;

const PASS = "test-dummy-pass";

async function appWithUser(): Promise<{ app: App; db: Kysely<Database> }> {
  const dialect = await migratedDialect();
  const db = createDb(dialect);
  await seedUser(db, "u1", "Tester", PASS);
  return { app: createApp(() => dialect), db };
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

test("correct password issues a session", async () => {
  const { app, db } = await appWithUser();

  const res = await login(app, {
    username: "u1",
    password: PASS,
    clientVersion: "1.2.3",
  });
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

  const session = await db
    .selectFrom("sessions")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(session.client_version).toBe("1.2.3");
  await db.destroy();
});

test("wrong password and unknown user are indistinguishable", async () => {
  const { app, db } = await appWithUser();

  const attempts = await Promise.all([
    login(app, {}),
    login(app, "not an object"),
    login(app, { username: "u1", password: "wrong" }),
    login(app, { username: "ghost", password: PASS }),
    login(app, { username: "u1" }),
  ]);
  const bodies = await Promise.all(attempts.map((res) => res.json()));
  for (const res of attempts) {
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  }
  for (const body of bodies) {
    expect(body).toEqual({ error: "invalid_credentials" });
  }
  await db.destroy();
});

test("sessions survive a worker restart", async () => {
  const dialect = await migratedDialect();
  const db = createDb(dialect);
  await seedUser(db, "u1", "Tester", PASS);
  const cookie = cookieOf(
    await login(
      createApp(() => dialect),
      {
        username: "u1",
        password: PASS,
      },
    ),
  );

  const rebooted = createApp(() => dialect);
  const res = await getSession(rebooted, cookie);
  expect(await res.json()).toEqual({ user: { id: "u1", name: "Tester" } });
  await db.destroy();
});

test("logout revokes only the current device's session", async () => {
  const { app, db } = await appWithUser();
  const phone = cookieOf(await login(app, { username: "u1", password: PASS }));
  const tablet = cookieOf(await login(app, { username: "u1", password: PASS }));

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

test("password_hash never stores the raw password and no endpoint returns it", async () => {
  const { app, db } = await appWithUser();
  const cookie = cookieOf(await login(app, { username: "u1", password: PASS }));

  const user = await db
    .selectFrom("users")
    .select("password_hash")
    .where("id", "=", "u1")
    .executeTakeFirstOrThrow();
  expect(user.password_hash).not.toBe(PASS);
  expect(user.password_hash).toMatch(/^pbkdf2\$/u);

  const sessions = await db.selectFrom("sessions").selectAll().execute();
  for (const session of sessions) {
    expect(session.id).toMatch(/^[0-9a-f]{64}$/u);
  }

  const whoami = await getSession(app, cookie);
  const body = await whoami.json();
  expect(JSON.stringify(body)).not.toContain(PASS);
  expect(JSON.stringify(body)).not.toContain("password");
  await db.destroy();
});
