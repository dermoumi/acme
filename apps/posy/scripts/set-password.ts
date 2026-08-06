import { createInterface } from "node:readline";
import { withDb } from "@acme/db/cli";
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
const remote = args.includes("--remote");
const username = args.find((arg) => !arg.startsWith("-"));

if (username) {
  const password = await readPassword();
  if (password) {
    const hash = await hashPassword(password);
    await withDb<Database>("DATABASE", { remote }, async (db) => {
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
  console.error("usage: pnpm set-password -- <username> [--remote]");
  console.error("  --remote reaches the deployed D1 instead of the local one");
  process.exitCode = 1;
}
