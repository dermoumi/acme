import { getTrustedProxies } from "#runtime";
import { afterEach, describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limiter";
import { TEST_BUDGETS, TEST_ROUTES, type TestBindings } from "./testing";

function buildLimiter() {
  return createRateLimiter<TestBindings>({
    budgets: TEST_BUDGETS,
    routes: TEST_ROUTES,
  });
}

describe("getTrustedProxies on node", () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXIES;
    delete process.env.PROXY_CIDRS;
  });

  it("takes the ranges TRUSTED_PROXIES names, trimmed", () => {
    process.env.TRUSTED_PROXIES = "10.0.0.0/8 , fc00::/7";

    expect(getTrustedProxies()).toEqual(["10.0.0.0/8", "fc00::/7"]);
  });

  // An operator who sets nothing must not end up believing every hop.
  it("trusts none where the variable is empty", () => {
    process.env.TRUSTED_PROXIES = "";

    expect(getTrustedProxies()).toEqual([]);
  });

  it("trusts none where the variable is unset", () => {
    expect(getTrustedProxies()).toEqual([]);
  });

  it("takes what a declared function reads out of the environment", () => {
    process.env.PROXY_CIDRS = "192.0.2.0/24";
    const fromEnv = (env: Record<string, string | undefined>) => {
      return env.PROXY_CIDRS?.split(",") ?? [];
    };

    expect(getTrustedProxies(fromEnv)).toEqual(["192.0.2.0/24"]);
  });

  // Declaring none is a decision, whichever form it takes.
  it("trusts none where a declared function reads nothing", () => {
    process.env.TRUSTED_PROXIES = "10.0.0.0/8";

    expect(getTrustedProxies(() => [])).toEqual([]);
  });

  it("prefers what the app declared over TRUSTED_PROXIES", () => {
    process.env.TRUSTED_PROXIES = "10.0.0.0/8";

    expect(getTrustedProxies(["192.0.2.0/24"])).toEqual(["192.0.2.0/24"]);
  });

  // Declaring none is a decision, so the environment must not override it.
  it("trusts none where the app declared an empty list", () => {
    process.env.TRUSTED_PROXIES = "10.0.0.0/8";

    expect(getTrustedProxies([])).toEqual([]);
  });
});

describe("createRateLimiter on node", () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXIES;
  });

  // The whole point of reading it: a typo fails the boot rather than leaving
  // every client behind the proxy sharing one bucket.
  it("throws on a range TRUSTED_PROXIES got wrong", () => {
    process.env.TRUSTED_PROXIES = "10.0.0.0/";

    expect(buildLimiter).toThrow("10.0.0.0/");
  });
});
