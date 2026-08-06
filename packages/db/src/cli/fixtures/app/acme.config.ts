import type { Kysely } from "kysely";

const table = (name: string) => ({
  up: async (db: Kysely<never>) => {
    await db.schema.createTable(name).addColumn("id", "text").execute();
  },
  down: async (db: Kysely<never>) => {
    await db.schema.dropTable(name).execute();
  },
});

const config = {
  db: [
    {
      binding: "MAIN",
      migrations: {
        "0001_users": table("users"),
        "0002_posts": table("posts"),
      },
      seed: async (db: Kysely<never>) => {
        await db.insertInto("users").values({ id: "seeded" }).execute();
      },
    },
    { binding: "ANALYTICS", migrations: { "0001_events": table("events") } },
    { binding: "RENAMED", urlVar: "RENAMED_DSN", migrations: {} },
  ],
};

export default config;
