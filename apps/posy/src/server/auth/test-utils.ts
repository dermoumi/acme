import { emptyDbEnv } from "@acme/db/testing";
import { createBindings } from "#testing/runtime";
import type { Kysely } from "kysely";
import type { AppBindings } from "../bindings";
import { createMigrator, type Database, getDb } from "../db";
import { hashPassword } from "./password";
import { DbSessionStore } from "./session-db";

/**
 * An env whose database is migrated and empty.
 *
 * Seeded through `getDb`, the accessor the routes themselves use, so the test
 * and the handler share one database. Reset the accessor between cases.
 */
export async function migratedEnv(): Promise<AppBindings> {
  // The one cast: @acme/db cannot know posy's binding types.
  const database = (await emptyDbEnv("DATABASE")) as Partial<AppBindings>;
  const env = createBindings(database);
  const migrator = createMigrator(await getDb({ env }));

  const { error } = await migrator.migrateToLatest();
  if (error) {
    throw new Error("migration failed", { cause: error });
  }

  return env;
}

export async function seedUser(
  db: Kysely<Database>,
  id: string,
  name = "Tester",
  password?: string,
): Promise<void> {
  await db
    .insertInto("users")
    .values({
      id,
      name,
      password_hash: password ? await hashPassword(password) : null,
      created_at: 1000,
    })
    .execute();
}

/** A migrated database holding one user, with a store over it. */
export async function seeded(): Promise<{
  db: Kysely<Database>;
  env: AppBindings;
  store: DbSessionStore;
}> {
  const env = await migratedEnv();
  const db = await getDb({ env });
  await seedUser(db, "u1");
  return { db, env, store: new DbSessionStore(db) };
}
