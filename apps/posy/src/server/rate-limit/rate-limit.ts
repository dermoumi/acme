import { clientKey } from "#rate-limit/runtime";
import type { MiddlewareHandler } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import type { Limiter, RateLimitBindings, RateLimitOptions } from "./contract";

const PERMIT_ALL: Limiter = {
  limit: () => Promise.resolve({ success: true }),
};

/**
 * Caps how often one client may call a route, keyed on its IP address.
 *
 * Fails open, so a missing binding cannot take down login, and mounts per
 * method, so reads that every page load performs stay uncapped. On Cloudflare
 * the binding is best-effort and counts per colo: a bound on cost, not a
 * security boundary.
 */
export function rateLimit(
  options: RateLimitOptions,
): MiddlewareHandler<{ Bindings: RateLimitBindings }> {
  const trust = { trustedProxies: options.trustedProxies ?? [] };

  return rateLimiter<{ Bindings: RateLimitBindings }>({
    // No binding, no limiting: an unconfigured route must not stop serving.
    binding: (ctx) => ctx.env[options.binding] ?? PERMIT_ALL,
    keyGenerator: (ctx) => clientKey(ctx, trust),
    // Cloudflare's outcome carries no reset time, so Retry-After is the whole
    // configured period rather than what is left of the window.
    handler: (ctx) => {
      ctx.res = ctx.json({ error: "rate_limited" }, 429, {
        "Retry-After": String(options.periodSeconds),
      });
    },
  });
}
