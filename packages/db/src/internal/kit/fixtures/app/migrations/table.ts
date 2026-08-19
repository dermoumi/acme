import type { Migration } from "kysely/migration";

// Typed by what a migration is, so the schema calls below are checked against
// the same contract the migrator will hold them to.
export function table(name: string): Migration {
  return {
    up: async (db) => {
      await db.schema.createTable(name).addColumn("id", "text").execute();
    },
    down: async (db) => {
      await db.schema.dropTable(name).execute();
    },
  };
}
