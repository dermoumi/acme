import { createBindings } from "#testing/runtime";
import type { AppBindings } from "../bindings";

// No D1 binding for workerd, no url for node: resolving throws, so a test using
// it proves the request never reached for a database, not just never queried.
export const noDatabase: Partial<AppBindings> = {
  DATABASE: undefined,
  DATABASE_URL: undefined,
};

export function noDatabaseEnv(): AppBindings {
  return createBindings(noDatabase);
}
