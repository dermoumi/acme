import { emptyDbEnv, getTestDb, migrateDb } from "@acme/db/testing";
import { createBindings } from "#testing/runtime";
import type { Kysely } from "kysely";
import type { AppBindings } from "../bindings";
import type { Database } from "../db";
import migrations from "../db/migrator";
import { hashPassword } from "./password";
import { DbSessionStore } from "./session-db";

/**
 * An env whose database is migrated and empty.
 *
 * Opened through the same accessor the routes reach, so the test and the
 * handler share one database. Reset between cases.
 */
export async function migratedEnv(): Promise<AppBindings> {
  // The one cast: @acme/db cannot know posy's binding types.
  const database = (await emptyDbEnv("DATABASE")) as Partial<AppBindings>;
  const env = createBindings(database);
  const db = await getTestDb("DATABASE", { env });
  await migrateDb(db, migrations);

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
  const db = await getTestDb("DATABASE", { env });
  await seedUser(db, "u1");
  return { db, env, store: new DbSessionStore(db) };
}
