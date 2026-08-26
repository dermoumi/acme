import { type Dialect, Kysely } from "kysely";

// The one place a `Kysely` is constructed, so a package-wide plugin lands here.
export function createDb<DB>(dialect: Dialect): Kysely<DB> {
  return new Kysely<DB>({ dialect });
}
