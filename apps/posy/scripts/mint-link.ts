import { D1Dialect } from "kysely-d1";
import { getPlatformProxy } from "wrangler";
import { mintPairingLink } from "../src/server/auth";
import type { AppBindings } from "../src/server/bindings";
import { createDb } from "../src/server/db";

// pnpm forwards a literal "--" separator; tolerate both invocation styles.
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const [userId, name] = args;
if (userId) {
  const { env, dispose } = await getPlatformProxy<AppBindings>();
  if (!env.DB) throw new Error("no DB binding in wrangler config");

  const db = createDb(new D1Dialect({ database: env.DB }));
  await db
    .insertInto("users")
    .values({ id: userId, name: name ?? userId, created_at: Date.now() })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  const code = await mintPairingLink(db, userId, Date.now());
  console.log(`http://localhost:5173/login?code=${code}`);
  await db.destroy();
  await dispose();
} else {
  console.error("usage: pnpm mint-link -- <user-id> [name]");
  process.exitCode = 1;
}
