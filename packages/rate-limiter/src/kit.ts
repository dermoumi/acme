/// <reference types="hono" />
import type { Kit } from "@acme/app";
import {
  createRateLimiter,
  type LimiterStatus,
  type RateLimiterConfig,
} from "./rate-limiter";

// Declared beside the vars that sets it, so a route reads it with no import.
declare module "hono" {
  interface ContextVariableMap {
    rateLimitStatus: LimiterStatus;
  }
}

/**
 * Caps how often one client may call the declared routes, keyed on IP.
 *
 * Mounts them itself, ahead of the app's own. Where nothing can count the route
 * keeps serving: this bounds cost, it is not a security boundary. Puts
 * `rateLimitStatus` on every request.
 *
 * @throws If a range is malformed, a budget is repeated, a route names no
 *   declared budget, or a budget caps no route.
 */
export function rateLimiterKit<Bindings extends object>(
  config: RateLimiterConfig<Bindings>,
): Kit {
  const limiter = createRateLimiter<Bindings>(config);

  return {
    name: "@acme/rate-limiter",
    config,
    init: () => ({
      middleware: (app) => {
        limiter.mount(app);
      },
      vars: (env) => {
        return { rateLimitStatus: limiter.status(env as Bindings) };
      },
    }),
  };
}
