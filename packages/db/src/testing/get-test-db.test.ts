import { defineConfig } from "@acme/app";
import { Kysely } from "kysely";
import { describe, expect, it } from "vitest";
import type { Items } from "../internal/kit/fixtures/schema";
import { databaseKit } from "../internal/kit/kit";
import { emptyDbEnv } from "./empty-env";
import { migrateDb } from "./migrate";
import { getTestDb } from "./get-test-db";

const migrations = {
  "0001_items": {
    up: async (db: Kysely<unknown>) => {
      await db.schema.createTable("items").addColumn("id", "text").execute();
    },
    down: async (db: Kysely<unknown>) => {
      await db.schema.dropTable("items").execute();
    },
  },
};

describe("getTestDb", () => {
  const config = () => {
    return defineConfig({ kits: [databaseKit([{ binding: "DATABASE" }])] });
  };

  it("empties a database and opens it when given no env", async () => {
    await expect(
      getTestDb("DATABASE", { config: config() }),
    ).resolves.toBeInstanceOf(Kysely);
  });

  // The url var, not the binding, is what node reads, so a derived
  // DATABASE_URL would find nothing here.
  it("empties through the url var a database renamed", async () => {
    const renamed = defineConfig({
      kits: [databaseKit([{ binding: "DATABASE", urlVar: "DATABASE_DSN" }])],
    });

    await expect(
      getTestDb("DATABASE", { config: renamed }),
    ).resolves.toBeInstanceOf(Kysely);
  });

  // An in-memory engine gives each connection its own data, so this is the
  // difference between a shared database and two empty ones.
  it("answers the very accessor the app's requests reach", async () => {
    const declared = config();
    const env = await emptyDbEnv("DATABASE");
    const onRequest = declared.kits?.[0]?.vars?.(env).getDb as (
      name: string,
    ) => Promise<Kysely<Items>>;

    expect(await getTestDb("DATABASE", { config: declared, env })).toBe(
      await onRequest("DATABASE"),
    );
  });

  it("says so when the config declares no database kit", async () => {
    await expect(
      getTestDb("DATABASE", { config: defineConfig({}), env: {} }),
    ).rejects.toThrow(/no database kit is declared/u);
  });
});

describe("migrateDb", () => {
  it("brings a database to its latest migration", async () => {
    const config = defineConfig({
      kits: [databaseKit([{ binding: "DATABASE" }])],
    });
    const db = await getTestDb("DATABASE", { config });

    await migrateDb(db, migrations);

    await expect(
      db.insertInto("items").values({ id: "one" }).execute(),
    ).resolves.toBeDefined();
  });
});
