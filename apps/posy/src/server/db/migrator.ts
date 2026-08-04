import { createMigrator as createDbMigrator, type Migrations } from "@acme/db";
import type { Kysely } from "kysely";
import type { Migrator } from "kysely/migration";
import * as init from "./migrations/0001_init";
import * as passwordAuth from "./migrations/0002_password_auth";
import type { Database } from "./schema";

// Add new migrations to this record, and never rename a key once it has run.
const migrations: Migrations = {
  "0001_init": init,
  "0002_password_auth": passwordAuth,
};

export function createMigrator(db: Kysely<Database>): Migrator {
  return createDbMigrator(db, migrations);
}
