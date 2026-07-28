import { createDb, createMigrator } from "./db";
import { fileDialect } from "./db/sqlite.node";

const db = createDb(fileDialect(process.env.DATABASE_PATH ?? "./posy.db"));
const { error, results } = await createMigrator(db).migrateToLatest();

for (const result of results ?? []) {
  console.log(`${result.status}: ${result.migrationName}`);
}

await db.destroy();

if (error) {
  console.error(error);
  process.exitCode = 1;
}
