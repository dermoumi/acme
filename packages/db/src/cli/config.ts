import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Kysely } from "kysely";
import type { Migrations } from "../internal/migrator";

export const CONFIG_FILE = "acme.config.ts";

/** Enough to reach a database. All any kit's CLI needs to open one. */
export interface DatabaseTarget {
  /** The D1 binding, matching what the app passed `defineDb`. */
  binding: string;
  /** Env var holding the url. Defaults to `${binding}_URL`. */
  urlVar?: string;
}

export interface DatabaseConfig<DB> extends DatabaseTarget {
  /** Keyed by name, in the order the keys sort. */
  migrations?: Migrations;
  /** Rows an empty deployment needs. Run by `acme-db seed`. */
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
 * One config per app, a section per kit, and a kit reads only its own.
 *
 * Sections are optional because an app takes the kits it wants: `acme-db` says
 * so plainly when `db` is missing rather than failing further in.
 */
export interface AcmeConfig {
  /** The app's database, or all of them in the order they migrate. */
  db?: AnyDatabaseConfig | AnyDatabaseConfig[];
}

/** Identity, but it types a database without the app naming a type. */
export function defineDbConfig<DB>(
  config: DatabaseConfig<DB>,
): DatabaseConfig<DB> {
  return config;
}

/** The `db` section as a list, however the app chose to write it. */
export function databases(config: AcmeConfig): AnyDatabaseConfig[] {
  const { db } = config;
  if (!db) {
    return [];
  }

  return Array.isArray(db) ? db : [db];
}

/** Reads the app's `acme.config.ts`. Shared by every kit's CLI. */
export async function loadAcmeConfig(cwd = process.cwd()): Promise<AcmeConfig> {
  const file = path.resolve(cwd, CONFIG_FILE);
  const loaded = (await import(pathToFileURL(file).href).catch(
    (cause: unknown) => {
      throw new Error(`could not read ${file}`, { cause });
    },
  )) as { default?: AcmeConfig };

  if (!loaded.default) {
    throw new Error(`${file} must export a config as its default`);
  }

  return loaded.default;
}

/** Finds a declared database by its binding, reading the config if not given. */
export async function databaseTarget(
  binding: string,
  config?: AcmeConfig,
): Promise<DatabaseTarget> {
  const db = databases(config ?? (await loadAcmeConfig()));
  const declared = db.find((entry) => entry.binding === binding);
  if (!declared) {
    const known = db.map((entry) => entry.binding).join(", ");
    throw new Error(
      `${CONFIG_FILE} declares no database bound to ${binding}${known ? `: ${known}` : ""}`,
    );
  }

  return declared;
}
