import { generatedId } from "@acme/db";
import type { Kysely } from "kysely";

async function createUsers(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("created_at", "integer", (col) => col.notNull())
    .execute();
}

async function createSessions(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("sessions")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
    .addColumn("created_at", "integer", (col) => col.notNull())
    .addColumn("last_seen_at", "integer", (col) => col.notNull())
    .execute();
}

async function createItems(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("items")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("rarity", "text", (col) => col.notNull())
    .addColumn("color", "text")
    .addColumn("tags", "text", (col) => col.notNull())
    .addColumn("set_id", "text", (col) => col.notNull())
    .addColumn("art_key", "text")
    .addColumn("created_at", "integer", (col) => col.notNull())
    .execute();
}

async function createDiscoveries(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("discoveries")
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
    .addColumn("item_id", "text", (col) => col.notNull().references("items.id"))
    .addColumn("first_at", "integer", (col) => col.notNull())
    .addPrimaryKeyConstraint("discoveries_pk", ["user_id", "item_id"])
    .execute();
}

async function createInventory(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("inventory")
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
    .addColumn("item_id", "text", (col) => col.notNull().references("items.id"))
    .addColumn("count", "integer", (col) => col.notNull().defaultTo(0))
    .addPrimaryKeyConstraint("inventory_pk", ["user_id", "item_id"])
    .execute();
}

async function createLedger(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("ledger")
    .$call(generatedId(db))
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
    .addColumn("delta", "integer", (col) => col.notNull())
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("ref", "text")
    .addColumn("created_at", "integer", (col) => col.notNull())
    .execute();
}

async function createIndexes(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex("ledger_user_id_idx")
    .on("ledger")
    .column("user_id")
    .execute();
  await db.schema
    .createIndex("sessions_user_id_idx")
    .on("sessions")
    .column("user_id")
    .execute();
  await db.schema
    .createIndex("items_type_idx")
    .on("items")
    .column("type")
    .execute();
}

// D1 has no transactions: keep migrations a flat sequence of small statements.
export async function up(db: Kysely<unknown>): Promise<void> {
  await createUsers(db);
  await createSessions(db);
  await createItems(db);
  await createDiscoveries(db);
  await createInventory(db);
  await createLedger(db);
  await createIndexes(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("ledger").execute();
  await db.schema.dropTable("inventory").execute();
  await db.schema.dropTable("discoveries").execute();
  await db.schema.dropTable("items").execute();
  await db.schema.dropTable("sessions").execute();
  await db.schema.dropTable("users").execute();
}
