import type { Dialect } from "kysely";

/** A dialect with no tables, so a contract test starts from a known schema. */
export type CreateEmptyDialect = () => Promise<Dialect>;
