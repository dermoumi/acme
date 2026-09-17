import { createKitContext } from "@acme/app/testing";
import type { HealthStatusOptions } from "@acme/health";
import { stubHealthKit } from "@acme/health/testing";
import { createBindings } from "#testing/runtime";
import { type Context, Hono } from "hono";
import { describe, expect, it } from "vitest";
import { rateLimiterKit } from "./kit";
import {
  client,
  post,
  sequence,
  TEST_BUDGETS,
  TEST_LIMIT,
  TEST_ROUTES,
  type TestBindings,
} from "./testing";

const KIT = "@acme/rate-limiter";

function buildKit() {
  return rateLimiterKit<TestBindings>({
    budgets: TEST_BUDGETS,
    routes: TEST_ROUTES,
  });
}

// The shape composeApp builds: the kit's middleware ahead of the app's routes.
function buildApp() {
  const app = new Hono<{ Bindings: TestBindings }>();
  const health = stubHealthKit(KIT);

  buildKit().init?.(health.context).middleware?.(app);
  app.all("*", (ctx) => ctx.text("served"));

  return app;
}

// What the kit hands the health kit while it initialises.
function getHealthStatus() {
  const health = stubHealthKit(KIT);
  buildKit().init?.(health.context);

  return health.status("rateLimit");
}

// The stub drops the options, and whether the line is detail is the point.
function getHealthOptions(): HealthStatusOptions | undefined {
  const context = createKitContext(KIT);
  let healthOptions: HealthStatusOptions | undefined;
  context.register("addHealthStatus", (_key, _status, options) => {
    healthOptions = options;
  });
  buildKit().init?.(context);

  return healthOptions;
}

// The status reads only the env, which is what a host hands the context.
const buildContext = (env: unknown) => {
  return { env } as Context;
};

describe("rateLimiterKit", () => {
  it("names itself by its specifier, so a reader can find it back", () => {
    expect(buildKit()).toMatchObject({ name: KIT });
  });

  it("carries what the app declared, for whoever reads it back", () => {
    expect(buildKit().config).toMatchObject({ routes: TEST_ROUTES });
  });

  // An app listing healthKit() after this one gets this throw, not a silent miss.
  it("throws where no declared kit registers the health registry", () => {
    const context = createKitContext(KIT);

    expect(() => buildKit().init?.(context)).toThrow(
      'requires "addHealthStatus"',
    );
  });

  it("caps a declared route once its budget is spent", async () => {
    const app = buildApp();
    const env = createBindings();
    const headers = client();

    await sequence(TEST_LIMIT, () => post(app, env, "/limited", headers));
    const refused = await post(app, env, "/limited", headers);

    expect(refused.status).toBe(429);
  });

  it("leaves a route it declared nothing for uncapped", async () => {
    const app = buildApp();
    const env = createBindings();
    const headers = client();

    const responses = await sequence(TEST_LIMIT * 2, () => {
      return post(app, env, "/elsewhere", headers);
    });

    for (const response of responses) expect(response.status).toBe(200);
  });

  // A periodic probe pays for the verdict alone; the breakdown is for a deploy.
  it("offers its status as detail, which the short body leaves out", () => {
    expect(getHealthOptions()).toEqual({ optional: true });
  });

  it("reports on every budget it declared", () => {
    const env = createBindings();

    expect(getHealthStatus()(buildContext(env))).toBe("on");
  });
});
