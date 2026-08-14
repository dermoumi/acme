import type { Migration } from "kysely/migration";
import type { AcmeConfig } from "../../config";

const table: Migration = {
  up: async (db) => {
    await db.schema.createTable("legacy").addColumn("id", "text").execute();
  },
  down: async (db) => {
    await db.schema.dropTable("legacy").execute();
  },
};

// The shape apps declared before the kit, which acme-db still reads.
const config = {
  db: { binding: "MAIN", migrations: { "0001_legacy": table } },
} satisfies AcmeConfig;

export default config;
