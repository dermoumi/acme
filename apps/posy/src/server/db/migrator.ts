import type { Kysely } from "kysely";
import { type Migration, Migrator } from "kysely/migration";
import * as init from "./migrations/0001_init";
import type { Database } from "./schema";

// In-code provider (not FileMigrationProvider): migrations must survive
// bundling into a Worker. Add new migrations to this record, never rename keys.
const migrations: Record<string, Migration> = {
  "0001_init": init,
};

export function createMigrator(db: Kysely<Database>): Migrator {
  return new Migrator({
    db,
    provider: {
      getMigrations: () => Promise.resolve(migrations),
    },
  });
}
