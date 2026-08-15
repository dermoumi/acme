import type { Kysely } from "kysely";
import type { Migrations } from "../internal/migrator";

/** One database an app declares. */
export interface DatabaseConfig {
  /** The D1 binding, matching what the app passed `defineDb`. */
  binding: string;
  /** Env var holding the url. Defaults to `${binding}_URL`. */
  urlVar?: string;
  /** Keyed by name, in the order the keys sort. */
  migrations?: Migrations;
  /**
   * Rows an empty deployment needs. Run by `acme seed`.
   *
   * Any schema, because only the app knows its own: the seed carries the type
   * it was written against, and this checks it is a database it takes at all.
   * `Kysely<never>` would be contravariant and refuse every real seed.
   */
  // oxlint-disable-next-line no-explicit-any
  seed?: (db: Kysely<any>) => Promise<void>;
}
