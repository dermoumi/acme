import type { Limiter } from "@acme/rate-limiter";
import type { GateBindings } from "./gate";

// Everything is optional: node names a url where workerd has a binding, and a
// missing limiter disables limiting for its route rather than failing it.
export interface AppBindings extends GateBindings {
  // The tier the debug gate reads. Everything else a deployment binds is read
  // by the kit that declared it, which never sees this.
  APP_ENV?: string;
  RATE_LIMIT_LOGIN?: Limiter;
  RATE_LIMIT_SENTRY?: Limiter;
}

// Only bindings today; the place a middleware's `Variables` would join.
export interface AppEnv {
  Bindings: AppBindings;
}
