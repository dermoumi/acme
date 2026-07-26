import { createEmptyDb } from "#testing/runtime";
import { type Kysely, sql } from "kysely";
import { NO_MIGRATIONS } from "kysely/migration";
import { expect, test } from "vitest";
import { createMigrator, jsonText, parseJsonText } from "./index";
import type { Database } from "./schema";

async function migratedDb(): Promise<Kysely<Database>> {
  const db = await createEmptyDb();
  const { error } = await createMigrator(db).migrateToLatest();
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
    .values({ id, name: "Tester", created_at: 1000 })
    .execute();
}

async function seedItem(
  db: Kysely<Database>,
  id: string,
  tags: string[],
): Promise<void> {
  await db
    .insertInto("items")
    .values({
      id,
      type: "flower",
      name: "Rose",
      rarity: "common",
      color: null,
      tags: jsonText(tags),
      set_id: "debut",
      art_key: null,
      created_at: 1000,
    })
    .execute();
}

test("migrates up from zero", async () => {
  const db = await createEmptyDb();
  const { error, results } = await createMigrator(db).migrateToLatest();
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
    "pairing_links",
    "sessions",
    "users",
  ]);
  await db.destroy();
});

test("down() reverts to an empty schema", async () => {
  const db = await migratedDb();
  const { error } = await createMigrator(db).migrateTo(NO_MIGRATIONS);
  expect(error).toBeUndefined();
  expect(await tableNames(db)).toEqual([]);
  await db.destroy();
});

test("users round-trip", async () => {
  const db = await migratedDb();
  await seedUser(db, "u1");
  const row = await db
    .selectFrom("users")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(row).toEqual({ id: "u1", name: "Tester", created_at: 1000 });
  await db.destroy();
});

test("sessions round-trip", async () => {
  const db = await migratedDb();
  await seedUser(db, "u1");
  await db
    .insertInto("sessions")
    .values({ id: "tok1", user_id: "u1", created_at: 1000, last_seen_at: 2000 })
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
  await db.destroy();
});

test("pairing links round-trip and reject unknown users", async () => {
  const db = await migratedDb();
  await seedUser(db, "u1");
  await db
    .insertInto("pairing_links")
    .values({
      token_hash: "hash1",
      user_id: "u1",
      created_at: 1000,
      expires_at: 2000,
      used_at: null,
    })
    .execute();
  const row = await db
    .selectFrom("pairing_links")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(row).toEqual({
    token_hash: "hash1",
    user_id: "u1",
    created_at: 1000,
    expires_at: 2000,
    used_at: null,
  });
  await expect(
    db
      .insertInto("pairing_links")
      .values({
        token_hash: "hash2",
        user_id: "ghost",
        created_at: 1000,
        expires_at: 2000,
        used_at: null,
      })
      .execute(),
  ).rejects.toThrow();
  await db.destroy();
});

test("items round-trip with JSON tags", async () => {
  const db = await migratedDb();
  await seedItem(db, "rose", ["pink", "spring"]);
  const row = await db
    .selectFrom("items")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(row.color).toBeNull();
  expect(row.art_key).toBeNull();
  expect(parseJsonText(row.tags)).toEqual(["pink", "spring"]);
  await db.destroy();
});

test("discoveries round-trip and composite pk rejects duplicates", async () => {
  const db = await migratedDb();
  await seedUser(db, "u1");
  await seedItem(db, "rose", []);
  await db
    .insertInto("discoveries")
    .values({ user_id: "u1", item_id: "rose", first_at: 1000 })
    .execute();
  const row = await db
    .selectFrom("discoveries")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(row).toEqual({ user_id: "u1", item_id: "rose", first_at: 1000 });
  await expect(
    db
      .insertInto("discoveries")
      .values({ user_id: "u1", item_id: "rose", first_at: 2000 })
      .execute(),
  ).rejects.toThrow();
  await db.destroy();
});

test("inventory round-trip with count defaulting to zero", async () => {
  const db = await migratedDb();
  await seedUser(db, "u1");
  await seedItem(db, "rose", []);
  await db
    .insertInto("inventory")
    .values({ user_id: "u1", item_id: "rose" })
    .execute();
  const row = await db
    .selectFrom("inventory")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(row).toEqual({ user_id: "u1", item_id: "rose", count: 0 });
  await db.destroy();
});

test("ledger balance is the sum of deltas", async () => {
  const db = await migratedDb();
  await seedUser(db, "u1");
  const entries = [
    { user_id: "u1", delta: 100, reason: "daily", ref: null, created_at: 1000 },
    {
      user_id: "u1",
      delta: -30,
      reason: "purchase",
      ref: "pack-1",
      created_at: 2000,
    },
    { user_id: "u1", delta: 5, reason: "bonus", ref: null, created_at: 3000 },
  ];
  await db.insertInto("ledger").values(entries).execute();
  const balance = await db
    .selectFrom("ledger")
    .select((eb) => eb.fn.sum<number>("delta").as("balance"))
    .where("user_id", "=", "u1")
    .executeTakeFirstOrThrow();
  expect(balance.balance).toBe(75);
  await db.destroy();
});
