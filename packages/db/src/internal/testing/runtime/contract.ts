import type { Dialect } from "kysely";

/**
 * An empty dialect, so a contract test starts from a known schema.
 */
export type CreateEmptyDialect = () => Promise<Dialect>;

/**
 * An env a `defineDb` accessor resolves that empty dialect from.
 */
export type CreateEmptyEnv = (
  binding: string,
  urlVar?: string,
) => Promise<Record<string, unknown>>;
