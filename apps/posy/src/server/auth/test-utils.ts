import { emptyDbEnv, getTestDb, migrateDb } from "@acme/db/testing";
import { createBindings } from "#testing/runtime";
import type { Kysely } from "kysely";
import type { AppBindings } from "../bindings";
import type { Database } from "../db";
import migrations from "../db/migrator";
import { hashPassword } from "./password";
import { DbSessionStore } from "./session-db";

// Opened through the same accessor the app reaches, so the test and the
// handler share one database. Reset between cases.
async function migratedEnv(): Promise<AppBindings> {
  // The one cast: @acme/db cannot know posy's binding types.
  const database = (await emptyDbEnv("DATABASE")) as Partial<AppBindings>;
  const env = createBindings(database);
  const db = await getTestDb("DATABASE", { env });
  await migrateDb(db, migrations);

  return env;
}

async function seedUser(
  db: Kysely<Database>,
  id: string,
  password?: string,
): Promise<void> {
  const passwordHash = password ? await hashPassword(password) : null;
  await db
    .insertInto("users")
    .values({
      id,
      name: "Tester",
      password_hash: passwordHash,
      created_at: 1000,
    })
    .execute();
}

export async function seeded(password?: string): Promise<{
  db: Kysely<Database>;
  env: AppBindings;
  store: DbSessionStore;
}> {
  const env = await migratedEnv();
  const db = await getTestDb("DATABASE", { env });
  await seedUser(db, "u1", password);
  return { db, env, store: new DbSessionStore(db) };
}
