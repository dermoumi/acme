import type { Kysely } from "kysely";

// D1 has no transactions: keep migrations a flat sequence of small statements.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("pairing_links")
    .addColumn("token_hash", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
    .addColumn("created_at", "integer", (col) => col.notNull())
    .addColumn("expires_at", "integer", (col) => col.notNull())
    .addColumn("used_at", "integer")
    .execute();
  await db.schema
    .createIndex("pairing_links_user_id_idx")
    .on("pairing_links")
    .column("user_id")
    .execute();
  await db.schema
    .alterTable("sessions")
    .addColumn("client_version", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("sessions").dropColumn("client_version").execute();
  await db.schema.dropTable("pairing_links").execute();
}
