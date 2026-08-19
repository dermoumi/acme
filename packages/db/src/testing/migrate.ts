import type { Kysely } from "kysely";
import { createMigrator, type Migrations } from "../internal/migrator";

/**
 * Brings a database to its latest migration.
 *
 * @param migrations Keyed by name, in the order the keys sort.
 * @throws If any fails, since a case without its schema cannot assert anything.
 */
export async function migrateDb<DB>(
  db: Kysely<DB>,
  migrations: Migrations,
): Promise<void> {
  const { error } = await createMigrator(db, migrations).migrateToLatest();
  if (error) {
    throw new Error("migration failed", { cause: error });
  }
}
