import type { Limiter } from "@acme/rate-limiter";
import type { SentryBindings } from "@acme/sentry/hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { GateBindings } from "./gate";

// DB is optional so tests can build bindings for routes that never touch it.
// A missing limiter disables limiting for its route rather than failing it.
export interface AppBindings extends GateBindings, SentryBindings {
  DB?: D1Database;
  RATE_LIMIT_LOGIN?: Limiter;
  RATE_LIMIT_SENTRY?: Limiter;
}
