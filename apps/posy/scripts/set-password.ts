import { createInterface } from "node:readline";
import { databaseNamed, withDb } from "@acme/db/cli";
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
const at = args.indexOf("--wrangler-env");
const wranglerEnv = at === -1 ? undefined : args[at + 1];
const rest = at === -1 ? args : [...args.slice(0, at), ...args.slice(at + 2)];
const username = rest.find((arg) => !arg.startsWith("-"));

if (username) {
  const password = await readPassword();
  if (password) {
    const hash = await hashPassword(password);
    const target = await databaseNamed("DATABASE");
    await withDb<Database>(target, { wranglerEnv }, async (db) => {
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
  console.error(
    "usage: pnpm set-password -- <username> [--wrangler-env <env>]",
  );
  console.error(
    "  naming an environment reaches its deployed D1, not a local one",
  );
  process.exitCode = 1;
}
