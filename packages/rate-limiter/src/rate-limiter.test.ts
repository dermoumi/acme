import { SELF_PROVISIONED } from "#runtime";
import { createBindings } from "#testing/runtime";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limiter";
import {
  client,
  limitedApp,
  OTHER_LIMIT,
  OTHER_PERIOD,
  post,
  sequence,
  OTHER_BUDGET,
  TEST_BUDGET,
  TEST_BUDGETS,
  TEST_LIMIT,
  TEST_PERIOD,
  TEST_ROUTE,
  type TestBindings,
} from "./testing";

// Built at module load on workerd, so a bad config fails the boot rather than
// sitting there uncapped for the worker's whole life.
describe("createRateLimiter", () => {
  it("throws on a malformed trusted proxy range", () => {
    expect(() => limitedApp({ trustedProxies: ["10.0.0.0/"] })).toThrow(
      "10.0.0.0/",
    );

    expect(() =>
      limitedApp({ trustedProxies: ["10.0.0.0/8", "fc00::/7"] }),
    ).not.toThrow();
  });

  it("throws when one binding carries two budgets", () => {
    const budgets = [...TEST_BUDGETS, TEST_BUDGET];

    expect(() => limitedApp({ budgets })).toThrow(
      "RATE_LIMIT_TEST is declared more than once",
    );
  });

  // A route naming a budget nobody declared would otherwise mount nothing.
  it("throws when a route names an undeclared budget", () => {
    const budgets = [OTHER_BUDGET];

    expect(() => limitedApp({ budgets })).toThrow(
      "POST /limited names an undeclared budget: RATE_LIMIT_TEST",
    );
  });

  // Otherwise status() reports a cap that sits on no route at all.
  it("throws when a budget caps no route", () => {
    const routes = [TEST_ROUTE];

    expect(() => limitedApp({ routes })).toThrow(
      "RATE_LIMIT_OTHER is declared but caps no route",
    );
  });
});

describe("mount", () => {
  it("refuses once the budget is spent", async () => {
    const app = limitedApp();
    const env = createBindings();
    const headers = client();

    const allowed = await sequence(TEST_LIMIT, () =>
      post(app, env, "/limited", headers),
    );
    for (const response of allowed) expect(response.status).toBe(200);

    const refused = await post(app, env, "/limited", headers);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe(String(TEST_PERIOD));
    expect(await refused.json()).toEqual({ error: "rate_limited" });
  });

  it("leaves methods it was not mounted on uncapped", async () => {
    const app = limitedApp();
    const env = createBindings();
    const headers = client();

    const reads = await sequence(TEST_LIMIT * 2, () =>
      app.request("/limited", { headers }, env),
    );
    for (const response of reads) expect(response.status).toBe(200);
  });

  it("gives each binding its own budget and period", async () => {
    const app = limitedApp();
    const env = createBindings();
    const headers = client();

    await sequence(TEST_LIMIT, () => post(app, env, "/limited", headers));
    const capped = await post(app, env, "/limited", headers);
    expect(capped.status).toBe(429);
    expect(capped.headers.get("Retry-After")).toBe(String(TEST_PERIOD));

    const other = await sequence(OTHER_LIMIT + 1, () =>
      post(app, env, "/other", headers),
    );
    expect(other.at(0)?.status).toBe(200);
    expect(other.at(-1)?.status).toBe(429);
    expect(other.at(-1)?.headers.get("Retry-After")).toBe(String(OTHER_PERIOD));
  });

  const spendUnbound = async () => {
    const app = limitedApp();
    const env = createBindings({ RATE_LIMIT_TEST: undefined });
    const headers = client();
    return sequence(TEST_LIMIT * 2, () => post(app, env, "/limited", headers));
  };

  it.skipIf(SELF_PROVISIONED)(
    "keeps serving when nothing can count",
    async () => {
      for (const response of await spendUnbound())
        expect(response.status).toBe(200);
    },
  );

  // Nothing to lose: the config described a budget, so it still applies.
  it.runIf(SELF_PROVISIONED)(
    "enforces its own budget when nothing is bound",
    async () => {
      const responses = await spendUnbound();
      expect(responses.some((response) => response.status === 429)).toBe(true);
    },
  );

  // Node keys every request "unknown" without @hono/node-server behind it.
  it.skipIf(SELF_PROVISIONED)(
    "counts each client address separately",
    async () => {
      const app = limitedApp();
      const env = createBindings();
      const spender = client();

      await sequence(TEST_LIMIT + 1, () => post(app, env, "/limited", spender));
      expect((await post(app, env, "/limited", spender)).status).toBe(429);
      expect((await post(app, env, "/limited", client())).status).toBe(200);
    },
  );
});

describe("status", () => {
  const readStatus = async (
    app: Hono<{ Bindings: TestBindings }>,
    env: TestBindings,
  ) => (await app.request("/status", {}, env)).text();

  // The one case limitedApp cannot cover: an app that declared no budget.
  const unlimitedApp = () => {
    const limiter = createRateLimiter<TestBindings>({
      budgets: [],
      routes: [],
    });
    const app = new Hono<{ Bindings: TestBindings }>();
    app.get("/status", (ctx) => ctx.text(limiter.status(ctx.env)));
    return app;
  };

  it("reads off when nothing was declared", async () => {
    // Bindings are present, but nothing enforces them, so "off" is the truth.
    expect(await readStatus(unlimitedApp(), createBindings())).toBe("off");
  });

  it("reads on when every budget can count", async () => {
    expect(await readStatus(limitedApp(), createBindings())).toBe("on");
  });

  // A runtime that builds its own limiters has no unbound state to report.
  it.skipIf(SELF_PROVISIONED)(
    "reads partial when only some are bound",
    async () => {
      const env = createBindings({ RATE_LIMIT_OTHER: undefined });
      expect(await readStatus(limitedApp(), env)).toBe("partial");
    },
  );

  it.skipIf(SELF_PROVISIONED)("reads off when none are bound", async () => {
    const env = createBindings({
      RATE_LIMIT_TEST: undefined,
      RATE_LIMIT_OTHER: undefined,
    });
    expect(await readStatus(limitedApp(), env)).toBe("off");
  });
});
