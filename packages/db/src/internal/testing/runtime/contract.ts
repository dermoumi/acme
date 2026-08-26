import type { Dialect } from "kysely";

// Empty, so a contract test starts from a known schema.
export type CreateEmptyDialect = () => Promise<Dialect>;

// The same dialect, behind an env an accessor can resolve from.
export type CreateEmptyEnv = (
  binding: string,
  urlVar?: string,
) => Promise<Record<string, unknown>>;
