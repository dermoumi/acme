import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:test";
import type { Kysely } from "kysely";
import { d1MigrationDialect } from "../../d1";
import { createDb } from "../../database";
import type { CreateEmptyDialect, CreateEmptyEnv } from "./contract";

// Retried in passes, not dropped in one sweep: a table a foreign key points at
// refuses to go until its dependants have, and D1 enforces that.
async function dropAll(db: Kysely<unknown>): Promise<void> {
  const tables = (await db.introspection.getTables())
    .map((table) => table.name)
    // D1 owns the _cf_* tables and rejects touching them.
    .filter((name) => !name.startsWith("_cf_"));
  if (tables.length === 0) return;

  const results = await Promise.allSettled(
    tables.map((name) => db.schema.dropTable(name).ifExists().execute()),
  );
  if (!results.some((result) => result.status === "fulfilled")) {
    throw new Error(`could not empty the database: ${tables.join(", ")}`);
  }

  return dropAll(db);
}

// The pool has no isolatedStorage, so every test shares one D1 instance:
// drop what the last one left, migration bookkeeping included.
export const createEmptyDialect: CreateEmptyDialect = async () => {
  const dialect = d1MigrationDialect(env.DATABASE as D1Database);
  const db = createDb(dialect);
  await dropAll(db);
  await db.destroy();
  return dialect;
};

export const createEmptyEnv: CreateEmptyEnv = async (binding) => {
  await createEmptyDialect();
  return { [binding]: env[binding] };
};
