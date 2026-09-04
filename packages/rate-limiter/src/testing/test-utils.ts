import { Hono } from "hono";
import {
  type Budget,
  createRateLimiter,
  type LimitedRoute,
  type RateLimiterConfig,
} from "../rate-limiter";
import { OTHER_LIMIT, OTHER_PERIOD, TEST_LIMIT, TEST_PERIOD } from "./budgets";
import type { TestBindings } from "./runtime/contract";

export const TEST_BUDGET: Budget<TestBindings> = {
  binding: "RATE_LIMIT_TEST",
  limit: TEST_LIMIT,
  periodSeconds: TEST_PERIOD,
};

export const OTHER_BUDGET: Budget<TestBindings> = {
  binding: "RATE_LIMIT_OTHER",
  limit: OTHER_LIMIT,
  periodSeconds: OTHER_PERIOD,
};

export const TEST_ROUTE: LimitedRoute<TestBindings> = {
  method: "POST",
  path: "/limited",
  binding: "RATE_LIMIT_TEST",
};

const OTHER_ROUTE: LimitedRoute<TestBindings> = {
  method: "POST",
  path: "/other",
  binding: "RATE_LIMIT_OTHER",
};

export const TEST_BUDGETS = [TEST_BUDGET, OTHER_BUDGET];
export const TEST_ROUTES = [TEST_ROUTE, OTHER_ROUTE];

export function limitedApp(
  overrides: Partial<RateLimiterConfig<TestBindings>> = {},
) {
  const limiter = createRateLimiter<TestBindings>({
    budgets: TEST_BUDGETS,
    routes: TEST_ROUTES,
    ...overrides,
  });
  const app = new Hono<{ Bindings: TestBindings }>();

  limiter.mount(app);
  app.get("/status", (ctx) => ctx.text(limiter.status(ctx.env)));
  app.all("*", (ctx) => ctx.text("served"));

  return app;
}

// Unique per test: workerd shares one limiter namespace across the whole file.
let clients = 0;
export function client(): Record<string, string> {
  clients += 1;
  return { "cf-connecting-ip": `203.0.113.${clients}` };
}

// Recursive rather than a loop: rate limiting is about order, so these requests
// must not overlap, and awaiting inside a loop is banned.
export async function sequence(
  times: number,
  run: () => Promise<Response> | Response,
  collected: Response[] = [],
): Promise<Response[]> {
  if (collected.length >= times) return collected;
  collected.push(await run());
  return sequence(times, run, collected);
}

export async function post(
  app: Hono<{ Bindings: TestBindings }>,
  env: TestBindings,
  path: string,
  headers: Record<string, string>,
): Promise<Response> {
  return app.request(path, { method: "POST", headers }, env);
}
