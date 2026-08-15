import type { Kysely } from "kysely";
import type { Migrations } from "../internal/migrator";

// Enough to reach a database, which is all `withDb` needs to open one.
export interface DatabaseTarget {
  /** The D1 binding, matching what the app passed `defineDb`. */
  binding: string;
  /** Env var holding the url. Defaults to `${binding}_URL`. */
  urlVar?: string;
}

/** One database an app declares, typed by the schema it holds. */
export interface DatabaseConfig<DB> extends DatabaseTarget {
  /** Keyed by name, in the order the keys sort. */
  migrations?: Migrations;
  /** Rows an empty deployment needs. Run by `acme seed`. */
  seed?: (db: Kysely<DB>) => Promise<void>;
}

/**
 * A declared database with its schema erased, which is all a CLI can see.
 *
 * Not `DatabaseConfig<unknown>`: `seed` takes the schema, so it is
 * contravariant, and that type would refuse every real config.
 */
export interface AnyDatabaseConfig extends DatabaseTarget {
  migrations?: Migrations;
  seed?: (db: never) => Promise<void>;
}

/**
 * Identity, but it types a database without the app naming a type.
 *
 * @param config - One database, whose `seed` is checked against `DB`.
 */
export function defineDbConfig<DB>(
  config: DatabaseConfig<DB>,
): DatabaseConfig<DB> {
  return config;
}
