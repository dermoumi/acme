import { createInterface } from "node:readline";
import type { KitCli } from "@acme/app/cli";
import { hashPassword } from "../server/auth";
import type { Database } from "../server/db";

// stdout carries nothing but the result, so a prompt on stderr keeps piping
// the password in from a script workable.
async function readPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });

  return new Promise((resolve) => {
    rl.question("password: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * posy's own commands, until they have a package to belong to.
 *
 * `set-password` is `@acme/auth`'s the moment that package exists; it lives
 * here so it can reach the database kit the same way that package will.
 */
export default function commands({ cli, require }: KitCli): void {
  cli
    .command(
      "set-password <username>",
      "set a user's password, read from stdin",
    )
    .option(
      "-e, --wrangler-env <env>",
      "reach its deployed D1, not a local one",
    )
    .action(async (username: string, options: { wranglerEnv?: string }) => {
      const password = await readPassword();
      if (!password) {
        throw new Error("password must be provided on stdin");
      }

      const hash = await hashPassword(password);
      const withDatabase = require("withDatabase");
      await withDatabase<Database>("DATABASE", options, async (db) => {
        await db
          .insertInto("users")
          .values({
            id: username,
            name: username,
            password_hash: hash,
            created_at: Date.now(),
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({ password_hash: hash }),
          )
          .execute();
        console.log(`password set for ${username}`);
      });
    });
}
