import { createInterface } from "node:readline";
import { hashPassword } from "../src/server/auth";
import { withDb } from "./d1-util";

async function readPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question("password: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const [username, target] = args;

if (username) {
  const password = await readPassword();
  if (password) {
    const hash = await hashPassword(password);
    await withDb(async (db) => {
      const result = await db
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
      if (result.length === 0) {
        throw new Error(`failed to set password for ${username}`);
      }
      console.log(`password set for ${username}`);
    }, target);
  } else {
    console.error("password must be provided on stdin");
    process.exitCode = 1;
  }
} else {
  console.error("usage: pnpm set-password -- <username> [database-id]");
  console.error("  omit database-id for local D1, provide it for remote");
  process.exitCode = 1;
}
