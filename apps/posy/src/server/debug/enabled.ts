import type { AppBindings } from "../bindings";

// Only these environments allow debug content.
const DEBUG_TIERS = new Set(["development", "preview", "staging"]);

export function isDebugEnabled(env: AppBindings): boolean {
  return DEBUG_TIERS.has(env.APP_ENV ?? "development");
}
