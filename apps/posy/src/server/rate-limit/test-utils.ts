import { createApp } from "../app";
import type { AppBindings } from "../bindings";
import type { RateLimitPolicy } from "./contract";

// The limiter answers before the handler, and an empty body is rejected before
// handleLogin opens a connection, so nothing here may reach a database.
export function noDatabase(): never {
  throw new Error("these tests must not reach the database");
}

// Self-contained: node enforces exactly these, workerd enforces wrangler.jsonc's,
// and the two are kept equal. Budgets are read back off the policy, never copied.
export const LOGIN_POLICY: RateLimitPolicy = {
  method: "POST",
  path: "/session",
  binding: "RATE_LIMIT_LOGIN",
  limit: 10,
  periodSeconds: 60,
};

export const SENTRY_POLICY: RateLimitPolicy = {
  method: "POST",
  path: "/sentry",
  binding: "RATE_LIMIT_SENTRY",
  limit: 60,
  periodSeconds: 60,
};

export const POLICIES: readonly RateLimitPolicy[] = [
  LOGIN_POLICY,
  SENTRY_POLICY,
];

export function testApp(rateLimits: readonly RateLimitPolicy[] = POLICIES) {
  return createApp({ getDialect: noDatabase, rateLimits });
}

export function unlimitedApp() {
  return createApp({ getDialect: noDatabase });
}

// Unique per test: workerd shares one limiter namespace across the whole file,
// while node gets a fresh in-memory one from every createBindings() call.
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
  app: ReturnType<typeof testApp>,
  env: AppBindings,
  path: string,
  headers: Record<string, string>,
  body = "{}",
): Promise<Response> {
  return app.request(path, { method: "POST", headers, body }, env);
}
