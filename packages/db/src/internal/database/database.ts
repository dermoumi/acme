import { type Dialect, Kysely } from "kysely";

// The one place a `Kysely` is constructed, so package-wide plugins can land
// here later without touching callers.
export function createDb<DB>(dialect: Dialect): Kysely<DB> {
  return new Kysely<DB>({ dialect });
}
