import { Pool } from "pg";

/**
 * Empties the database `url` points at, by recreating its `public` schema.
 *
 * Expects a database dedicated to these tests. One schema rather than one per
 * worker on purpose: kysely's postgres introspector sweeps every user schema, so
 * a second one lets the Migrator find another test's `kysely_migration_lock` and
 * skip creating its own. The postgres project sets `fileParallelism: false` so
 * only one test is ever in here.
 */
export async function resetPostgres(url: string): Promise<void> {
  const admin = new Pool({ connectionString: url, max: 1 });
  try {
    await admin.query("drop schema if exists public cascade");
    await admin.query("create schema public");
  } finally {
    await admin.end();
  }
}
