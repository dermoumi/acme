import { SELF_PROVISIONED } from "#rate-limit/runtime";
import { createBindings } from "#testing/runtime";
import type { Store } from "hono-rate-limiter";
import { expect, test } from "vitest";
import { createApp } from "../app";
import type { AppBindings } from "../bindings";
import type { RateLimitPolicy } from "./contract";
import {
  client,
  LOGIN_POLICY,
  noDatabase,
  POLICIES,
  post,
  SENTRY_POLICY,
  sequence,
  testApp,
  unlimitedApp,
} from "./test-utils";

test("login is capped, and the refusal says when to come back", async () => {
  const app = testApp();
  const env = createBindings();
  const headers = client();

  const allowed = await sequence(LOGIN_POLICY.limit, () =>
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

  const reads = await sequence(LOGIN_POLICY.limit * 2, () =>
    app.request("/session", { headers }, env),
  );
  for (const response of reads) expect(response.status).toBe(200);

  const ends = await sequence(LOGIN_POLICY.limit * 2, () =>
    app.request("/session", { method: "DELETE", headers }, env),
  );
  for (const response of ends) expect(response.status).toBe(204);
});

test("a refusal cannot tell real usernames from invented ones", async () => {
  const app = testApp();
  const env = createBindings();
  const headers = client();

  await sequence(LOGIN_POLICY.limit + 1, () =>
    post(app, env, "/session", headers),
  );

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

test("an unbound budget disables limiting only where bindings supply it", async () => {
  const app = testApp();
  const env = createBindings({ RATE_LIMIT_LOGIN: undefined });
  const headers = client();

  const responses = await sequence(LOGIN_POLICY.limit * 2, () =>
    post(app, env, "/session", headers),
  );

  if (SELF_PROVISIONED) {
    // Nothing to lose: the policy still describes a budget, so it still applies.
    expect(responses.some((response) => response.status === 429)).toBe(true);
    return;
  }
  for (const response of responses) expect(response.status).toBe(401);
});

test("an app declaring no policies does not limit, bindings or not", async () => {
  const app = unlimitedApp();
  const env = createBindings();
  const headers = client();

  const responses = await sequence(LOGIN_POLICY.limit * 2, () =>
    post(app, env, "/session", headers),
  );
  for (const response of responses) expect(response.status).toBe(401);

  // Bindings are present here, but nothing enforces them, so "off" is the truth.
  const health = await app.request("/health", {}, env);
  expect(await health.json()).toMatchObject({ rateLimit: "off" });
});

test("trustedProxies reaches the limiter from createApp", () => {
  // createApp runs at module load on workerd, so a malformed range is a worker
  // that fails to boot rather than one silently trusting nobody for its life.
  expect(() =>
    createApp({
      getDialect: noDatabase,
      rateLimits: POLICIES,
      trustedProxies: ["10.0.0.0/"],
    }),
  ).toThrow("10.0.0.0/");

  // Checked even with nothing mounted, or the typo waits for the first policy.
  expect(() =>
    createApp({ getDialect: noDatabase, trustedProxies: ["10.0.0.0/"] }),
  ).toThrow("10.0.0.0/");

  expect(() =>
    createApp({
      getDialect: noDatabase,
      rateLimits: POLICIES,
      trustedProxies: ["10.0.0.0/8", "fc00::/7"],
    }),
  ).not.toThrow();
});

test("each policy reports its own Retry-After", async () => {
  // One binding for both, so workerd shares a counter; node builds one limiter
  // per policy. The tunnel budget of 1 needs at most two calls either way.
  const app = testApp([
    {
      method: "POST",
      path: "/session",
      binding: "RATE_LIMIT_LOGIN",
      limit: LOGIN_POLICY.limit,
      periodSeconds: 60,
    },
    {
      method: "POST",
      path: "/sentry",
      binding: "RATE_LIMIT_LOGIN",
      limit: 1,
      periodSeconds: 10,
    },
  ]);
  const env = createBindings();
  const headers = client();

  await sequence(LOGIN_POLICY.limit, () => post(app, env, "/session", headers));
  const login = await post(app, env, "/session", headers);
  expect(login.status).toBe(429);
  expect(login.headers.get("Retry-After")).toBe("60");

  const tunnel = await sequence(2, () => post(app, env, "/sentry", headers));
  expect(tunnel.at(-1)?.status).toBe(429);
  expect(tunnel.at(-1)?.headers.get("Retry-After")).toBe("10");
});

test("two policies capping one route refuse to build", () => {
  // Both mount, so the request is charged twice: the /sentry/* bug again.
  expect(() =>
    createApp({
      getDialect: noDatabase,
      rateLimits: [LOGIN_POLICY, { ...LOGIN_POLICY, periodSeconds: 10 }],
    }),
  ).toThrow("POST /session");

  // A different method on the same path is a different route, and fine.
  expect(() =>
    createApp({
      getDialect: noDatabase,
      rateLimits: [LOGIN_POLICY, { ...LOGIN_POLICY, method: "DELETE" }],
    }),
  ).not.toThrow();
});

test("a supplied store does the counting, one per policy", async () => {
  // Workers count in the platform binding, so there is nothing to substitute.
  if (!SELF_PROVISIONED) return;

  const seen: string[] = [];
  const counting = (policy: RateLimitPolicy): Store => {
    let hits = 0;
    return {
      init: () => undefined,
      increment: (key) => {
        hits += 1;
        seen.push(`${policy.binding} ${key}`);
        return Promise.resolve({ totalHits: hits });
      },
      decrement: () => undefined,
      resetKey: () => undefined,
    };
  };

  const app = createApp({
    getDialect: noDatabase,
    rateLimits: POLICIES,
    rateLimitStore: counting,
  });
  const env = createBindings();
  const headers = client();

  const responses = await sequence(LOGIN_POLICY.limit + 1, () =>
    post(app, env, "/session", headers),
  );
  expect(responses.at(-1)?.status).toBe(429);
  expect(seen).toHaveLength(LOGIN_POLICY.limit + 1);
  expect(seen.every((entry) => entry.startsWith("RATE_LIMIT_LOGIN"))).toBe(
    true,
  );

  // The tunnel's budget counts separately, in its own store.
  await post(app, env, "/sentry", headers);
  expect(seen.at(-1)).toContain("RATE_LIMIT_SENTRY");
});

async function healthStatus(
  rateLimits: readonly RateLimitPolicy[],
  env: AppBindings,
) {
  const res = await testApp(rateLimits).request("/health", {}, env);
  return res.json();
}

test("health follows the policy list, not a fixed set of bindings", async () => {
  expect(await healthStatus([], createBindings())).toMatchObject({
    rateLimit: "off",
  });
  expect(await healthStatus(POLICIES, createBindings())).toMatchObject({
    rateLimit: "on",
  });

  // Guarded on the capability, not the runtime: a runtime that builds limiters
  // from the policies has no unbound state to report.
  if (SELF_PROVISIONED) return;

  // The discriminating case: a fixed binding list would call this partial,
  // since it cannot know the login budget is one this app never declared.
  expect(
    await healthStatus(
      [SENTRY_POLICY],
      createBindings({ RATE_LIMIT_LOGIN: undefined }),
    ),
  ).toMatchObject({ rateLimit: "on" });

  expect(
    await healthStatus(
      POLICIES,
      createBindings({ RATE_LIMIT_SENTRY: undefined }),
    ),
  ).toMatchObject({ rateLimit: "partial" });
});

test("the sentry tunnel has its own budget", async () => {
  const app = testApp();
  const env = createBindings();
  const headers = client();

  const allowed = await sequence(SENTRY_POLICY.limit, () =>
    post(app, env, "/sentry", headers),
  );
  for (const response of allowed) expect(response.status).not.toBe(429);

  const refused = await post(app, env, "/sentry", headers);
  expect(refused.status).toBe(429);
});
