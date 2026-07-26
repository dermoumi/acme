import { getPlatformProxy } from "wrangler";
import type { AppBindings } from "../src/server/bindings";
import { createDb, createMigrator } from "../src/server/db";
import { d1MigrationDialect } from "./d1-migration-dialect";

const { env, dispose } = await getPlatformProxy<AppBindings>();
if (!env.DB) throw new Error("no DB binding in wrangler config");

const db = createDb(d1MigrationDialect(env.DB));
const { error, results } = await createMigrator(db).migrateToLatest();
for (const result of results ?? []) {
  console.log(`${result.status}: ${result.migrationName}`);
}
await db.destroy();
await dispose();

if (error) {
  console.error(error);
  process.exitCode = 1;
}
