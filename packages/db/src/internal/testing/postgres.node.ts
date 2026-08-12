import { Pool } from "pg";

/**
 * Empties the database `url` points at by recreating its `public` schema.
 *
 * Expects a database dedicated to these tests. One schema, not one per worker:
 * kysely's postgres introspector sweeps every user schema, so a second one
 * lets the Migrator find another test's lock table and skip creating its own.
 * The postgres project runs files serially for the same reason.
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
