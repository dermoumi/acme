import { SELF_PROVISIONED } from "#runtime";
import { createBindings } from "#testing/runtime";
import { expect, test } from "vitest";
import { createRateLimiter } from "./rate-limiter";
import {
  client,
  limitedApp,
  OTHER_BUDGET,
  post,
  sequence,
  TEST_BUDGET,
  unlimitedApp,
} from "./testing";

test("a capped route refuses once the budget is spent, and says when to return", async () => {
  const app = limitedApp();
  const env = createBindings();
  const headers = client();

  const allowed = await sequence(TEST_BUDGET.limit, () =>
    post(app, env, "/limited", headers),
  );
  for (const response of allowed) expect(response.status).toBe(200);

  const refused = await post(app, env, "/limited", headers);
  expect(refused.status).toBe(429);
  expect(refused.headers.get("Retry-After")).toBe(
    String(TEST_BUDGET.periodSeconds),
  );
  expect(await refused.json()).toEqual({ error: "rate_limited" });
});

test("the limiter caps only what it is mounted on", async () => {
  const app = limitedApp();
  const env = createBindings();
  const headers = client();

  // Same path, a method nothing mounted.
  const reads = await sequence(TEST_BUDGET.limit * 2, () =>
    app.request("/limited", { headers }, env),
  );
  for (const response of reads) expect(response.status).toBe(200);
});

test("each binding carries its own budget and its own Retry-After", async () => {
  const app = limitedApp();
  const env = createBindings();
  const headers = client();

  await sequence(TEST_BUDGET.limit, () => post(app, env, "/limited", headers));
  const capped = await post(app, env, "/limited", headers);
  expect(capped.status).toBe(429);
  expect(capped.headers.get("Retry-After")).toBe(
    String(TEST_BUDGET.periodSeconds),
  );

  const other = await sequence(OTHER_BUDGET.limit + 1, () =>
    post(app, env, "/other", headers),
  );
  expect(other.at(0)?.status).toBe(200);
  expect(other.at(-1)?.status).toBe(429);
  expect(other.at(-1)?.headers.get("Retry-After")).toBe(
    String(OTHER_BUDGET.periodSeconds),
  );
});

test("an unbound budget still serves where only the platform can count", async () => {
  const app = limitedApp();
  const env = createBindings({ RATE_LIMIT_TEST: undefined });
  const headers = client();

  const responses = await sequence(TEST_BUDGET.limit * 2, () =>
    post(app, env, "/limited", headers),
  );

  if (SELF_PROVISIONED) {
    // Nothing to lose: create() still described a budget, so it still applies.
    expect(responses.some((response) => response.status === 429)).toBe(true);
    return;
  }
  for (const response of responses) expect(response.status).toBe(200);
});

test("one client spending its budget does not cap another", async () => {
  // Node keys every request "unknown" without @hono/node-server behind it.
  if (SELF_PROVISIONED) return;

  const app = limitedApp();
  const env = createBindings();
  const spender = client();

  await sequence(TEST_BUDGET.limit + 1, () =>
    post(app, env, "/limited", spender),
  );
  expect((await post(app, env, "/limited", spender)).status).toBe(429);
  expect((await post(app, env, "/limited", client())).status).toBe(200);
});

test("status reports what create was asked for, not what is bound", async () => {
  const env = createBindings();

  // Bindings are present here, but nothing enforces them, so "off" is the truth.
  expect(await (await unlimitedApp().request("/status", {}, env)).text()).toBe(
    "off",
  );
  expect(await (await limitedApp().request("/status", {}, env)).text()).toBe(
    "on",
  );

  // A runtime that builds its own limiters has no unbound state to report.
  if (SELF_PROVISIONED) return;

  const half = await limitedApp().request(
    "/status",
    {},
    createBindings({ RATE_LIMIT_OTHER: undefined }),
  );
  expect(await half.text()).toBe("partial");

  const none = await limitedApp().request(
    "/status",
    {},
    createBindings({ RATE_LIMIT_TEST: undefined, RATE_LIMIT_OTHER: undefined }),
  );
  expect(await none.text()).toBe("off");
});

test("malformed trusted proxies throw when the limiter is built", () => {
  // Built at module load on workerd, so a typo fails the boot rather than
  // silently trusting nobody for the worker's whole life.
  expect(() => createRateLimiter({ trustedProxies: ["10.0.0.0/"] })).toThrow(
    "10.0.0.0/",
  );

  expect(() =>
    createRateLimiter({ trustedProxies: ["10.0.0.0/8", "fc00::/7"] }),
  ).not.toThrow();
});
