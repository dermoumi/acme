import type { Kysely } from "kysely";
import { d1MigrationDialect, remoteD1Dialect } from "../d1";
import { createDb } from "../internal/database";
import { urlVarFor } from "../internal/db/url-var.node";
import { dialectFromUrl } from "../internal/uri/uri.node";
import type { DatabaseTarget } from "./config.node";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} must be set`);
  }

  return value;
}

// Only the local-D1 path needs wrangler, so an app that never takes it does not
// have to install it.
async function localD1<DB>(binding: string) {
  const wrangler = await import("wrangler").catch((cause: unknown) => {
    throw new Error("acme-db needs wrangler to reach a local D1", { cause });
  });
  const platform = await wrangler.getPlatformProxy();
  const database = platform.env[binding];
  if (!database) {
    throw new Error(`no ${binding} binding in the wrangler config`);
  }

  return {
    db: createDb<DB>(d1MigrationDialect(database as never)),
    dispose: () => platform.dispose(),
  };
}

/**
 * Opens the database a command should act on, and closes it afterwards.
 *
 * Three ways in, in order: a database id names a remote D1 over the HTTP API;
 * otherwise the url env var wins, which is how a node deployment migrates; and
 * failing both it falls back to the local D1 wrangler serves.
 *
 * Exported so other kits' CLIs reach a database the same way.
 */
export async function withDb<DB>(
  target: DatabaseTarget,
  databaseId: string | undefined,
  run: (db: Kysely<DB>) => Promise<void>,
): Promise<void> {
  if (databaseId) {
    const db = createDb<DB>(
      remoteD1Dialect({
        accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
        apiToken: requireEnv("CLOUDFLARE_API_TOKEN"),
        databaseId,
      }),
    );
    await run(db);
    await db.destroy();
    return;
  }

  const url = process.env[urlVarFor(target.binding, target.urlVar)];
  if (url) {
    const db = createDb<DB>(await dialectFromUrl(url));
    await run(db);
    await db.destroy();
    return;
  }

  const { db, dispose } = await localD1<DB>(target.binding);
  await run(db);
  await db.destroy();
  await dispose();
}
