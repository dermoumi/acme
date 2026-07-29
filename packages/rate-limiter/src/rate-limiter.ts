import { clientAddress, getBinding, SELF_PROVISIONED } from "#runtime";
import { rateLimiter } from "hono-rate-limiter";
import { bound } from "./bindings";
import type {
  LimiterStatus,
  RateLimiter,
  RateLimiterOptions,
} from "./contract";
import { compileTrustedProxies } from "./trusted-proxies";

/**
 * Caps how often one client may call the routes it is mounted on, keyed on IP.
 * Where only the platform counts and nothing is bound, the route keeps serving:
 * this bounds cost, it is not a security boundary. Build one per app.
 */
export function createRateLimiter<Bindings extends object>(
  options: RateLimiterOptions = {},
): RateLimiter<Bindings> {
  // Compiled even when nothing is mounted, so a typo cannot sit unnoticed.
  const trusted = compileTrustedProxies(options.trustedProxies ?? []);
  const declared = new Set<string>();

  return {
    create(binding, limit, periodSeconds) {
      declared.add(binding);
      return rateLimiter<{ Bindings: Bindings }>({
        binding: getBinding(binding, limit, periodSeconds),
        // Unidentifiable callers share one budget.
        keyGenerator: (ctx) => clientAddress(ctx, trusted) ?? "unknown",
        handler: (ctx) => {
          ctx.res = ctx.json({ error: "rate_limited" }, 429, {
            "Retry-After": String(periodSeconds),
          });
        },
      });
    },

    status(env): LimiterStatus {
      if (declared.size === 0) return "off";
      if (SELF_PROVISIONED) return "on";

      const count = [...declared].filter((name) => bound(env, name)).length;
      return count === declared.size ? "on" : count === 0 ? "off" : "partial";
    },
  };
}
