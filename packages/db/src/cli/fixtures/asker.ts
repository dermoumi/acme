import type { KitCli } from "@acme/app/cli";
import type { WithDatabase } from "../with-db";

// Writes a table, so a test can tell which database was actually opened.
export default function asker({ cli, require }: KitCli): void {
  cli
    .command("ask <binding>", "open a database by binding alone")
    .action(async (binding: string) => {
      const withDatabase = require<WithDatabase>("withDatabase");
      await withDatabase<never>(binding, {}, async (db) => {
        await db.schema.createTable("asked").addColumn("id", "text").execute();
      });
    });
}
