import type { SentryBindings } from "@acme/sentry/hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { GateBindings } from "./gate";

// DB is optional so tests can build bindings for routes that never touch it.
export interface AppBindings extends GateBindings, SentryBindings {
  DB?: D1Database;
}
