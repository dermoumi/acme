import { createMigrator } from "@acme/db";
import { getDb, migrations } from "./db";

// `acme-db migrate` needs the source tree and tsx; the image ships neither.
const db = await getDb({ env: process.env });
const { error, results } = await createMigrator(
  db,
  migrations,
).migrateToLatest();

for (const result of results ?? []) {
  console.log(`${result.status}: ${result.migrationName}`);
}

await db.destroy();

if (error) {
  console.error(error);
  process.exitCode = 1;
}
