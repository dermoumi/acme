import { Pool } from "pg";

// One schema, not one per worker: kysely's postgres introspector sweeps every
// user schema, so a second lets the Migrator find another test's lock table.
export async function resetPostgres(url: string): Promise<void> {
  const admin = new Pool({ connectionString: url, max: 1 });
  try {
    await admin.query("drop schema if exists public cascade");
    await admin.query("create schema public");
  } finally {
    await admin.end();
  }
}
