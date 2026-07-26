import { createBindings, createEmptyDialect } from "#testing/runtime";
import type { Dialect, Kysely } from "kysely";
import type { AppBindings } from "../bindings";
import { createDb, createMigrator, type Database } from "../db";

export async function migratedDialect(): Promise<Dialect> {
  const dialect = await createEmptyDialect();
  const { error } = await createMigrator(createDb(dialect)).migrateToLatest();
  if (error) throw new Error("migration failed", { cause: error });
  return dialect;
}

export async function seedUser(
  db: Kysely<Database>,
  id: string,
  name = "Tester",
): Promise<void> {
  await db.insertInto("users").values({ id, name, created_at: 1000 }).execute();
}

export const testEnv: AppBindings = createBindings();
