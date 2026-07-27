import type { AppBindings } from "../bindings";

// Routes that throw on purpose have no business in production.
export function isDebugEnabled(env: AppBindings): boolean {
  return (env.APP_ENV ?? "development") !== "production";
}
