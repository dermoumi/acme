import type { Kit } from "@acme/app";
import type { Context } from "hono";
import type { HealthStatus } from "@acme/health";
import { createRateLimiter, type RateLimiterConfig } from "./rate-limiter";

/**
 * Counts one request against a declared budget; false once it is spent.
 *
 * Throws on a budget the kit was not given.
 */
export type ConsumeRateLimit = (
  ctx: Context,
  binding: string,
) => Promise<boolean>;

declare module "hono" {
  interface ContextVariableMap {
    consumeRateLimit: ConsumeRateLimit;
  }
}

/**
 * Caps how often one client may call the declared routes, keyed on IP.
 *
 * Mounts them itself, ahead of the app's own. Where nothing can count the route
 * keeps serving: this bounds cost, it is not a security boundary. A route can
 * also spend a budget itself through `ctx.var.consumeRateLimit(ctx, binding)`.
 *
 * Reports itself to `@acme/health`, so an app declares that one too, in any
 * order.
 *
 * @throws From `init`, if a range is malformed, a budget is repeated, or a
 *   route names no declared budget.
 */
export function rateLimiterKit<Bindings extends object>(
  config: RateLimiterConfig<Bindings>,
): Kit {
  return {
    name: "@acme/rate-limiter",
    config,
    requires: ["@acme/health"],
    // Built here, not in the factory: a config is read on build machines too.
    init: ({ require }) => {
      const limiter = createRateLimiter<Bindings>(config);
      const limiterStatus: HealthStatus = (ctx) => {
        return limiter.status(ctx.env as Bindings);
      };

      const addHealthStatus = require("addHealthStatus");
      addHealthStatus("rateLimit", limiterStatus, { optional: true });

      const consumeRateLimit: ConsumeRateLimit = (ctx, binding) => {
        return limiter.consume(ctx, binding);
      };

      return {
        vars: () => ({ consumeRateLimit }),
        middleware: (app) => {
          limiter.mount(app);
        },
      };
    },
  };
}
