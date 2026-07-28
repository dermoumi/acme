import {
  clientKey,
  createLimiter,
  SELF_PROVISIONED,
} from "#rate-limit/runtime";
import type { MiddlewareHandler } from "hono";
import { rateLimiter, type Store } from "hono-rate-limiter";
import type {
  Limiter,
  LimiterStatus,
  RateLimitBindings,
  RateLimitPolicy,
} from "./contract";
import type { TrustedProxies } from "./trusted-proxies";

const PERMIT_ALL: Limiter = {
  limit: () => Promise.resolve({ success: true }),
};

/**
 * Whether limiting is in force, for `/health`. It fails open, so a lost budget
 * is invisible until the bill arrives, and `partial` is the case worth catching:
 * a `ratelimits` entry in two of wrangler's three env blocks half-covers prod.
 */
export function limiterStatus(
  env: RateLimitBindings,
  policies: readonly RateLimitPolicy[],
): LimiterStatus {
  // Deduped: two policies may share one budget, and that is one thing to bind.
  const named = new Set(policies.map((policy) => policy.binding));
  if (named.size === 0) return "off";
  if (SELF_PROVISIONED) return "on";

  const bound = [...named].filter((name) => env[name]).length;
  if (bound === 0) return "off";
  return bound === named.size ? "on" : "partial";
}

/**
 * Caps how often one client may call a route, keyed on its IP address.
 *
 * No binding and no locally provisioned limiter means no limiting, so an
 * unconfigured route keeps serving. On Cloudflare the binding is best-effort
 * and counts per colo: a bound on cost, not a security boundary.
 */
export function rateLimit(
  policy: RateLimitPolicy,
  trustedProxies: TrustedProxies = [],
  store?: Store,
): MiddlewareHandler<{ Bindings: RateLimitBindings }> {
  const trust = { trustedProxies };
  // Built once per middleware, so each app gets its own budget rather than
  // sharing one that outlives it.
  const provisioned = createLimiter(policy, store);

  return rateLimiter<{ Bindings: RateLimitBindings }>({
    // A bound limiter still wins, so a node entrypoint can supply a shared one.
    binding: (ctx) => ctx.env[policy.binding] ?? provisioned ?? PERMIT_ALL,
    keyGenerator: (ctx) => clientKey(ctx, trust),
    // Cloudflare's outcome carries no reset time, so Retry-After is the whole
    // declared period rather than what is left of the window.
    handler: (ctx) => {
      ctx.res = ctx.json({ error: "rate_limited" }, 429, {
        "Retry-After": String(policy.periodSeconds),
      });
    },
  });
}
