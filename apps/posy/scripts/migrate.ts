import { createMigrator } from "../src/server/db";
import { withDb } from "./d1-util";

await withDb(async (db) => {
  const { error, results } = await createMigrator(db).migrateToLatest();
  for (const result of results ?? []) {
    console.log(`${result.status}: ${result.migrationName}`);
  }
  if (error) {
    console.error(error);
    process.exitCode = 1;
  }
}, process.argv[2]);
