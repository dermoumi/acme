import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("password_hash", "text")
    .execute();
  await db.schema
    .alterTable("sessions")
    .addColumn("client_version", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("sessions").dropColumn("client_version").execute();
  await db.schema.alterTable("users").dropColumn("password_hash").execute();
}
