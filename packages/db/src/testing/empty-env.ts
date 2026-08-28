import { createEmptyEnv } from "#testing/runtime";
import type { DatabaseOptions } from "../internal/db";
import { urlVarFor } from "../internal/db/url-var";

/**
 * An environment naming an empty database, whichever runtime is running.
 *
 * A D1 binding with its schema dropped on workerd, a url on node, so an app's
 * tests never learn which engine they are on. Pass the binding name the app
 * gave `defineDb`.
 */
export async function emptyDbEnv(
  binding: string,
  options: DatabaseOptions = {},
): Promise<Record<string, unknown>> {
  return createEmptyEnv(binding, options.urlVar);
}

/**
 * An environment naming no database at all, whichever runtime is running.
 *
 * Neither the binding a worker takes nor the url a node process reads, so
 * resolving throws rather than opening an empty one: what a test proving a
 * request never reached for a database needs. Pass the binding name the app
 * gave `defineDb`.
 */
export function unboundDbEnv(
  binding: string,
  options: DatabaseOptions = {},
): Record<string, undefined> {
  return {
    [binding]: undefined,
    [urlVarFor(binding, options.urlVar)]: undefined,
  };
}
