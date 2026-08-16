import { defineConfig } from "@acme/app";
import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { database } from "../../kit";

// A real schema, the way an app declares one: the seed below carries the type
// it was written against, which is all `database` asks of it.
interface Main {
  users: { id: string };
}

// Typed by what a migration is, so the schema calls below are checked against
// the same contract the migrator will hold them to.
const table = (name: string): Migration => ({
  up: async (db) => {
    await db.schema.createTable(name).addColumn("id", "text").execute();
  },
  down: async (db) => {
    await db.schema.dropTable(name).execute();
  },
});

const config = defineConfig({
  kits: [
    database([
      {
        binding: "MAIN",
        migrations: {
          "0001_users": table("users"),
          "0002_posts": table("posts"),
        },
        seed: async (db: Kysely<Main>) => {
          await db.insertInto("users").values({ id: "seeded" }).execute();
        },
      },
      { binding: "ANALYTICS", migrations: { "0001_events": table("events") } },
      { binding: "RENAMED", urlVar: "RENAMED_DSN", migrations: {} },
    ]),
  ],
});

export default config;
