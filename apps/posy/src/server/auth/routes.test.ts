import { resetDb } from "@acme/db/testing";
import type { Hono } from "hono";
import type { Kysely } from "kysely";
import { beforeEach, expect, test } from "vitest";
import { createApp } from "../app";
import type { AppBindings, AppEnv } from "../bindings";
import { type Database, getDb } from "../db";
import { SESSION_COOKIE } from "./session";
import { migratedEnv, seedUser } from "./test-utils";

type App = Hono<AppEnv>;

const PASS = "test-dummy-pass";

// The accessor holds its database for the life of the process, so each test
// starts by dropping the last one's.
beforeEach(() => resetDb(getDb));

async function appWithUser(): Promise<{
  app: App;
  db: Kysely<Database>;
  env: AppBindings;
}> {
  const env = await migratedEnv();
  const db = await getDb({ env });
  await seedUser(db, "u1", "Tester", PASS);
  return { app: createApp(), db, env };
}

async function login(
  app: App,
  env: AppBindings,
  body: unknown,
): Promise<Response> {
  return app.request(
    "/session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );
}

function cookieOf(res: Response): string {
  const header = res.headers.get("set-cookie") ?? "";
  const match = /posy_session=([^;]*)/u.exec(header);
  if (!match) throw new Error("no session cookie in response");
  return `${SESSION_COOKIE}=${match[1]}`;
}

async function getSession(
  app: App,
  env: AppBindings,
  cookie?: string,
): Promise<Response> {
  return app.request(
    "/session",
    cookie ? { headers: { Cookie: cookie } } : {},
    env,
  );
}

test("correct password issues a session", async () => {
  const { app, db, env } = await appWithUser();

  const res = await login(app, env, {
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

  const whoami = await getSession(app, env, cookieOf(res));
  expect(await whoami.json()).toEqual({ user: { id: "u1", name: "Tester" } });

  const session = await db
    .selectFrom("sessions")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(session.client_version).toBe("1.2.3");
});

test("wrong password and unknown user are indistinguishable", async () => {
  const { app, env } = await appWithUser();

  const attempts = await Promise.all([
    login(app, env, {}),
    login(app, env, "not an object"),
    login(app, env, { username: "u1", password: "wrong" }),
    login(app, env, { username: "ghost", password: PASS }),
    login(app, env, { username: "u1" }),
  ]);
  const bodies = await Promise.all(attempts.map((res) => res.json()));
  for (const res of attempts) {
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  }
  for (const body of bodies) {
    expect(body).toEqual({ error: "invalid_credentials" });
  }
});

// A second createApp over the same accessor is what a restarted worker sees.
test("sessions survive a worker restart", async () => {
  const { app, env } = await appWithUser();
  const cookie = cookieOf(
    await login(app, env, { username: "u1", password: PASS }),
  );

  const res = await getSession(createApp(), env, cookie);
  expect(await res.json()).toEqual({ user: { id: "u1", name: "Tester" } });
});

test("logout revokes only the current device's session", async () => {
  const { app, env } = await appWithUser();
  const phone = cookieOf(
    await login(app, env, { username: "u1", password: PASS }),
  );
  const tablet = cookieOf(
    await login(app, env, { username: "u1", password: PASS }),
  );

  const res = await app.request(
    "/session",
    { method: "DELETE", headers: { Cookie: phone } },
    env,
  );
  expect(res.status).toBe(204);
  expect(res.headers.get("set-cookie")).toContain("Max-Age=0");

  expect(await (await getSession(app, env, phone)).json()).toEqual({
    user: null,
  });
  expect(await (await getSession(app, env, tablet)).json()).toEqual({
    user: { id: "u1", name: "Tester" },
  });
});

test("logout without a session is a 204 no-op", async () => {
  const { app, env } = await appWithUser();
  const res = await app.request("/session", { method: "DELETE" }, env);
  expect(res.status).toBe(204);
});

test("password_hash never stores the raw password and no endpoint returns it", async () => {
  const { app, db, env } = await appWithUser();
  const cookie = cookieOf(
    await login(app, env, { username: "u1", password: PASS }),
  );

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

  const whoami = await getSession(app, env, cookie);
  const body = await whoami.json();
  expect(JSON.stringify(body)).not.toContain(PASS);
  expect(JSON.stringify(body)).not.toContain("password");
});
