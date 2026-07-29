import { Hono } from "hono";
import { createRateLimiter } from "../rate-limiter";
import type { RateLimiterOptions } from "../contract";
import type { TestBindings } from "./contract";

// Kept equal to vitest.config.ts: node enforces these, workerd miniflare's.
export const TEST_BUDGET = { limit: 3, periodSeconds: 60 };
export const OTHER_BUDGET = { limit: 1, periodSeconds: 10 };

export function limitedApp(options: RateLimiterOptions = {}) {
  const limiter = createRateLimiter<TestBindings>(options);
  const app = new Hono<{ Bindings: TestBindings }>();

  app.on(
    "POST",
    "/limited",
    limiter.create(
      "RATE_LIMIT_TEST",
      TEST_BUDGET.limit,
      TEST_BUDGET.periodSeconds,
    ),
  );
  app.on(
    "POST",
    "/other",
    limiter.create(
      "RATE_LIMIT_OTHER",
      OTHER_BUDGET.limit,
      OTHER_BUDGET.periodSeconds,
    ),
  );
  app.get("/status", (ctx) => ctx.text(limiter.status(ctx.env)));
  app.all("*", (ctx) => ctx.text("served"));

  return app;
}

export function unlimitedApp() {
  const limiter = createRateLimiter<TestBindings>();
  const app = new Hono<{ Bindings: TestBindings }>();

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
