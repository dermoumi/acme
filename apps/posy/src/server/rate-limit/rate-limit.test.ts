import { createBindings } from "#testing/runtime";
import { expect, test } from "vitest";
import { createApp } from "../app";
import type { AppBindings } from "../bindings";
import { LOGIN_LIMIT, PERIOD_SECONDS, SENTRY_LIMIT } from "./contract";

// The limiter answers before the handler, and an empty body is rejected before
// handleLogin opens a connection, so nothing here may reach a database.
function noDatabase(): never {
  throw new Error("these tests must not reach the database");
}

function testApp() {
  return createApp({
    getDialect: noDatabase,
    rateLimitPeriodSeconds: PERIOD_SECONDS,
  });
}

// Separate helper rather than testApp(undefined): passing undefined to an
// optional parameter would just fall back to the default and limit anyway.
function unlimitedApp() {
  return createApp({ getDialect: noDatabase });
}

// Unique per test: workerd shares one limiter namespace across the whole file,
// while node gets a fresh in-memory one from every createBindings() call.
let clients = 0;
function client(): Record<string, string> {
  clients += 1;
  return { "cf-connecting-ip": `203.0.113.${clients}` };
}

// Recursive rather than a loop: rate limiting is about order, so these requests
// must not overlap, and awaiting inside a loop is banned.
async function sequence(
  times: number,
  run: () => Promise<Response> | Response,
  collected: Response[] = [],
): Promise<Response[]> {
  if (collected.length >= times) return collected;
  collected.push(await run());
  return sequence(times, run, collected);
}

async function post(
  app: ReturnType<typeof testApp>,
  env: AppBindings,
  path: string,
  headers: Record<string, string>,
  body = "{}",
): Promise<Response> {
  return app.request(path, { method: "POST", headers, body }, env);
}

test("login is capped, and the refusal says when to come back", async () => {
  const app = testApp();
  const env = createBindings();
  const headers = client();

  const allowed = await sequence(LOGIN_LIMIT, () =>
    post(app, env, "/session", headers),
  );
  for (const response of allowed) expect(response.status).toBe(401);

  const refused = await post(app, env, "/session", headers);
  expect(refused.status).toBe(429);
  expect(refused.headers.get("Retry-After")).toBe("60");
  expect(await refused.json()).toEqual({ error: "rate_limited" });
});

test("reading and ending a session are never capped", async () => {
  const app = testApp();
  const env = createBindings();
  const headers = client();

  const reads = await sequence(LOGIN_LIMIT * 2, () =>
    app.request("/session", { headers }, env),
  );
  for (const response of reads) expect(response.status).toBe(200);

  const ends = await sequence(LOGIN_LIMIT * 2, () =>
    app.request("/session", { method: "DELETE", headers }, env),
  );
  for (const response of ends) expect(response.status).toBe(204);
});

test("a refusal cannot tell real usernames from invented ones", async () => {
  const app = testApp();
  const env = createBindings();
  const headers = client();

  await sequence(LOGIN_LIMIT + 1, () => post(app, env, "/session", headers));

  const real = await post(
    app,
    env,
    "/session",
    headers,
    JSON.stringify({ username: "sara", password: "guess" }),
  );
  const invented = await post(
    app,
    env,
    "/session",
    headers,
    JSON.stringify({ username: "nobody", password: "guess" }),
  );

  expect(real.status).toBe(429);
  expect(invented.status).toBe(429);
  expect(await real.text()).toBe(await invented.text());
  expect(real.headers.get("Retry-After")).toBe(
    invented.headers.get("Retry-After"),
  );
});

test("a missing binding disables limiting instead of refusing requests", async () => {
  const app = testApp();
  const env = createBindings({ RATE_LIMIT_LOGIN: undefined });
  const headers = client();

  const responses = await sequence(LOGIN_LIMIT * 2, () =>
    post(app, env, "/session", headers),
  );
  for (const response of responses) expect(response.status).toBe(401);
});

test("an app built without a period does not limit, bindings or not", async () => {
  const app = unlimitedApp();
  const env = createBindings();
  const headers = client();

  const responses = await sequence(LOGIN_LIMIT * 2, () =>
    post(app, env, "/session", headers),
  );
  for (const response of responses) expect(response.status).toBe(401);

  // Bindings are present here, but nothing enforces them, so "off" is the truth.
  const health = await app.request("/health", {}, env);
  expect(await health.json()).toMatchObject({ rateLimit: "off" });
});

test("the sentry tunnel has its own budget", async () => {
  const app = testApp();
  const env = createBindings();
  const headers = client();

  const allowed = await sequence(SENTRY_LIMIT, () =>
    post(app, env, "/sentry", headers),
  );
  for (const response of allowed) expect(response.status).not.toBe(429);

  const refused = await post(app, env, "/sentry", headers);
  expect(refused.status).toBe(429);
});
