import type { Dialect } from "kysely";

/** A dialect with no tables, so a contract test starts from a known schema. */
export type CreateEmptyDialect = () => Promise<Dialect>;

/** The same, as an env an accessor built by `defineDb` can resolve from. */
export type CreateEmptyEnv = (
  binding: string,
  urlVar?: string,
) => Promise<Record<string, unknown>>;
