import { type Dialect, Kysely } from "kysely";

/**
 * Builds a query builder over a dialect, generic in the app's schema.
 *
 * The one place a `Kysely` is constructed, so package-wide plugins can land
 * here later without touching callers.
 */
export function createDb<DB>(dialect: Dialect): Kysely<DB> {
  return new Kysely<DB>({ dialect });
}
