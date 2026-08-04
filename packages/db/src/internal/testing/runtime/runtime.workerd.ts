import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:test";
import { createDb } from "../../database";
import { d1MigrationDialect } from "../../../d1";
import type { CreateEmptyDialect } from "./contract";

// The pool has no isolatedStorage, so every test shares one D1 instance:
// drop what the last one left, migration bookkeeping included.
export const createEmptyDialect: CreateEmptyDialect = async () => {
  const dialect = d1MigrationDialect(env.DB as D1Database);
  const db = createDb(dialect);
  const tables = await db.introspection.getTables();
  for (const table of tables) {
    // D1 owns the _cf_* tables and rejects touching them.
    if (table.name.startsWith("_cf_")) continue;
    // oxlint-disable-next-line no-await-in-loop -- parallel drops can race
    await db.schema.dropTable(table.name).ifExists().execute();
  }
  await db.destroy();
  return dialect;
};
