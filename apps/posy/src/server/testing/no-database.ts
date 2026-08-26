import { createBindings } from "#testing/runtime";
import type { AppBindings } from "../bindings";

/**
 * An environment naming no database at all: no D1 binding for workerd, no url
 * for node. Resolving it throws, so a test using it proves the request never
 * reached for the database, not merely that it never queried a table.
 */
export const noDatabase: Partial<AppBindings> = {
  DATABASE: undefined,
  DATABASE_URL: undefined,
};

/**
 * Bindings for a route that must never use a database.
 */
export function noDatabaseEnv(): AppBindings {
  return createBindings(noDatabase);
}
