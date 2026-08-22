import type { Limiter } from "@acme/rate-limiter";
import type { SentryBindings } from "@acme/sentry/hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { GateBindings } from "./gate";

// Everything is optional: node names a url where workerd has a binding, and a
// missing limiter disables limiting for its route rather than failing it.
export interface AppBindings extends GateBindings, SentryBindings {
  DATABASE?: D1Database;
  DATABASE_URL?: string;
  RATE_LIMIT_LOGIN?: Limiter;
  RATE_LIMIT_SENTRY?: Limiter;
}

// Only bindings today; the place a middleware's `Variables` would join.
export interface AppEnv {
  Bindings: AppBindings;
}
