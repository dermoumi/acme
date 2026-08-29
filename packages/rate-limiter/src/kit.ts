import type { Kit } from "@acme/app";
import type { HealthStatus } from "@acme/health";
import { createRateLimiter, type RateLimiterConfig } from "./rate-limiter";

/**
 * Caps how often one client may call the declared routes, keyed on IP.
 *
 * Mounts them itself, ahead of the app's own. Where nothing can count the route
 * keeps serving: this bounds cost, it is not a security boundary.
 *
 * Reports itself to `@acme/health`, so an app declares that one ahead of it.
 *
 * @throws If a range is malformed, a budget is repeated, a route names no
 *   declared budget, or a budget caps no route.
 */
export function rateLimiterKit<Bindings extends object>(
  config: RateLimiterConfig<Bindings>,
): Kit {
  const limiter = createRateLimiter<Bindings>(config);
  const limiterStatus: HealthStatus = (ctx) => {
    return limiter.status(ctx.env as Bindings);
  };

  return {
    name: "@acme/rate-limiter",
    config,
    init: ({ require }) => {
      const addHealthStatus = require("addHealthStatus");
      addHealthStatus("rateLimit", limiterStatus, { optional: true });

      return {
        middleware: (app) => {
          limiter.mount(app);
        },
      };
    },
  };
}
