import { createEmptyEnv } from "#testing/runtime";
import type { DatabaseOptions } from "../internal/db";

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
