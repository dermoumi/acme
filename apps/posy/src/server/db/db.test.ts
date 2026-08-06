import { createMigrator, jsonText, parseJsonText } from "@acme/db";
import { emptyDbEnv, resetDb } from "@acme/db/testing";
import { type Kysely, sql } from "kysely";
import { NO_MIGRATIONS } from "kysely/migration";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, migrations } from "./index";
import type { Database } from "./schema";

// @acme/db proves the migrator works, against tables it invents. Only these
// prove posy's migrations build what schema.ts declares, which nothing checks.

beforeEach(() => resetDb(getDb));

async function emptyDb(): Promise<Kysely<Database>> {
  return getDb({ env: await emptyDbEnv("DATABASE") });
}

async function migratedDb(): Promise<Kysely<Database>> {
  const db = await emptyDb();
  const { error } = await createMigrator(db, migrations).migrateToLatest();
  if (error) throw new Error("migration failed", { cause: error });
  return db;
}

async function tableNames(db: Kysely<Database>): Promise<string[]> {
  const rows = await sql<{ name: string }>`
    select name from sqlite_master
    where type = 'table' and name not like 'sqlite_%'
      and name not like '%migration%' and name not glob '_cf_*'
  `.execute(db);
  return rows.rows.map((row) => row.name).toSorted();
}

async function seedUser(db: Kysely<Database>, id: string): Promise<void> {
  await db
    .insertInto("users")
    .values({ id, name: "Tester", password_hash: null, created_at: 1000 })
    .execute();
}

async function seedItem(db: Kysely<Database>, id: string): Promise<void> {
  await db
    .insertInto("items")
    .values({
      id,
      type: "flower",
      name: id,
      rarity: "common",
      color: null,
      tags: jsonText([]),
      set_id: "debut",
      art_key: null,
      created_at: 1000,
    })
    .execute();
}

describe("posy's migration set", () => {
  it("builds every table the schema declares", async () => {
    const db = await emptyDb();
    const { error, results } = await createMigrator(
      db,
      migrations,
    ).migrateToLatest();
    expect(error).toBeUndefined();
    expect(results?.map((result) => result.status)).toEqual([
      "Success",
      "Success",
    ]);
    expect(await tableNames(db)).toEqual([
      "discoveries",
      "inventory",
      "items",
      "ledger",
      "sessions",
      "users",
    ]);
  });

  it("reverts to nothing, so a rollback leaves no table behind", async () => {
    const db = await migratedDb();
    const { error } = await createMigrator(db, migrations).migrateTo(
      NO_MIGRATIONS,
    );
    expect(error).toBeUndefined();
    expect(await tableNames(db)).toEqual([]);
  });
});

describe("posy's schema", () => {
  it("round-trips every users column, with and without a password hash", async () => {
    const db = await migratedDb();
    await seedUser(db, "u1");
    await db
      .insertInto("users")
      .values({
        id: "u2",
        name: "Hashed",
        password_hash: "pbkdf2$200000$salt$hash",
        created_at: 1000,
      })
      .execute();

    const rows = await db
      .selectFrom("users")
      .selectAll()
      .orderBy("id")
      .execute();
    expect(rows).toEqual([
      { id: "u1", name: "Tester", password_hash: null, created_at: 1000 },
      {
        id: "u2",
        name: "Hashed",
        password_hash: "pbkdf2$200000$salt$hash",
        created_at: 1000,
      },
    ]);
  });

  it("leaves sessions.client_version null when it is not set", async () => {
    const db = await migratedDb();
    await seedUser(db, "u1");
    await db
      .insertInto("sessions")
      .values({
        id: "tok1",
        user_id: "u1",
        created_at: 1000,
        last_seen_at: 2000,
      })
      .execute();

    const row = await db
      .selectFrom("sessions")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row).toEqual({
      id: "tok1",
      user_id: "u1",
      created_at: 1000,
      last_seen_at: 2000,
      client_version: null,
    });
  });

  it("keeps items.tags as JSON, with color and art_key nullable", async () => {
    const db = await migratedDb();
    await db
      .insertInto("items")
      .values({
        id: "rose",
        type: "flower",
        name: "Rose",
        rarity: "common",
        color: null,
        tags: jsonText(["pink", "spring"]),
        set_id: "debut",
        art_key: null,
        created_at: 1000,
      })
      .execute();

    const row = await db
      .selectFrom("items")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row.color).toBeNull();
    expect(row.art_key).toBeNull();
    expect(parseJsonText(row.tags)).toEqual(["pink", "spring"]);
  });

  // Both columns, not just the first: a key on user_id alone would still reject
  // the duplicate below, so the second insert is what actually pins the pair.
  it("keys discoveries on user and item together", async () => {
    const db = await migratedDb();
    await seedUser(db, "u1");
    await seedItem(db, "rose");
    await seedItem(db, "tulip");

    const discover = (item: string, at: number) =>
      db
        .insertInto("discoveries")
        .values({ user_id: "u1", item_id: item, first_at: at })
        .execute();

    await discover("rose", 1000);
    await discover("tulip", 1100);
    expect(
      await db.selectFrom("discoveries").selectAll().execute(),
    ).toHaveLength(2);

    await expect(discover("rose", 2000)).rejects.toThrow();
  });

  it("defaults inventory.count to zero", async () => {
    const db = await migratedDb();
    await seedUser(db, "u1");
    await seedItem(db, "rose");
    await db
      .insertInto("inventory")
      .values({ user_id: "u1", item_id: "rose" })
      .execute();

    const row = await db
      .selectFrom("inventory")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ user_id: "u1", item_id: "rose", count: 0 });
  });

  it("round-trips every ledger column, including a negative delta", async () => {
    const db = await migratedDb();
    await seedUser(db, "u1");
    await db
      .insertInto("ledger")
      .values([
        {
          user_id: "u1",
          delta: 100,
          reason: "daily",
          ref: null,
          created_at: 1000,
        },
        {
          user_id: "u1",
          delta: -30,
          reason: "purchase",
          ref: "pack-1",
          created_at: 2000,
        },
      ])
      .execute();

    const rows = await db
      .selectFrom("ledger")
      .select(["user_id", "delta", "reason", "ref", "created_at"])
      .orderBy("created_at")
      .execute();
    expect(rows).toEqual([
      {
        user_id: "u1",
        delta: 100,
        reason: "daily",
        ref: null,
        created_at: 1000,
      },
      {
        user_id: "u1",
        delta: -30,
        reason: "purchase",
        ref: "pack-1",
        created_at: 2000,
      },
    ]);
  });
});
