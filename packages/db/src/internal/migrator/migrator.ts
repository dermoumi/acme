import type { Kysely } from "kysely";
import { type Migration, Migrator } from "kysely/migration";

/** Migrations keyed by name, in the order the keys sort. */
export type Migrations = Record<string, Migration>;

/**
 * Builds a `Migrator` over migrations the app holds in code.
 *
 * Deliberately not `FileMigrationProvider`: it reads the filesystem at runtime,
 * which does not survive bundling into a Worker. Apps pass a record of imported
 * migration modules instead, and must never rename a key once it has run.
 */
export function createMigrator<DB>(
  db: Kysely<DB>,
  migrations: Migrations,
): Migrator {
  return new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  });
}
