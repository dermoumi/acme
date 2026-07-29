import { Hono } from "hono";
import { createRateLimiter, type RateLimiterOptions } from "../rate-limiter";
import { OTHER_LIMIT, OTHER_PERIOD, TEST_LIMIT, TEST_PERIOD } from "./budgets";
import type { TestBindings } from "./runtime/contract";

export function limitedApp(options: RateLimiterOptions = {}) {
  const limiter = createRateLimiter<TestBindings>(options);
  const app = new Hono<{ Bindings: TestBindings }>();

  app.on(
    "POST",
    "/limited",
    limiter.create("RATE_LIMIT_TEST", TEST_LIMIT, TEST_PERIOD),
  );
  app.on(
    "POST",
    "/other",
    limiter.create("RATE_LIMIT_OTHER", OTHER_LIMIT, OTHER_PERIOD),
  );
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
