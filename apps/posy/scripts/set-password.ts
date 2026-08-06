import { createInterface } from "node:readline";
import { withDb } from "@acme/db/cli";
import config from "../acme.config";
import { hashPassword } from "../src/server/auth";
import type { Database } from "../src/server/db";

async function readPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question("password: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const [username, target] = args;

if (username) {
  const password = await readPassword();
  if (password) {
    const hash = await hashPassword(password);
    await withDb<Database>(config.db, target, async (db) => {
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
  } else {
    console.error("password must be provided on stdin");
    process.exitCode = 1;
  }
} else {
  console.error("usage: pnpm set-password -- <username> [database-id]");
  console.error("  omit database-id for local D1, provide it for remote");
  process.exitCode = 1;
}
