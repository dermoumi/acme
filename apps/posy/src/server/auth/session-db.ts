import type { Kysely } from "kysely";
import type { Database } from "../db";
import type { SessionStore } from "./session";

export class DbSessionStore implements SessionStore {
  public constructor(private db: Kysely<Database>) {}

  public async create(
    id: string,
    userId: string,
    clientVersion: string | null,
    now: number,
  ): Promise<void> {
    await this.db
      .insertInto("sessions")
      .values({
        id,
        user_id: userId,
        created_at: now,
        last_seen_at: now,
        client_version: clientVersion,
      })
      .execute();
  }

  public async get(
    id: string,
  ): Promise<{ userId: string; lastSeenAt: number } | null> {
    const row = await this.db
      .selectFrom("sessions")
      .select(["user_id", "last_seen_at"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    return { userId: row.user_id, lastSeenAt: row.last_seen_at };
  }

  public async touch(id: string, now: number): Promise<void> {
    await this.db
      .updateTable("sessions")
      .set({ last_seen_at: now })
      .where("id", "=", id)
      .execute();
  }

  public async revoke(id: string): Promise<void> {
    await this.db.deleteFrom("sessions").where("id", "=", id).execute();
  }
}
