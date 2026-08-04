import { createDb } from "@acme/db";
import { d1MigrationDialect, remoteD1Dialect } from "@acme/db/d1";
import type { Kysely } from "kysely";
import { getPlatformProxy } from "wrangler";
import type { AppBindings } from "../src/server/bindings";
import type { Database } from "../src/server/db";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} must be set`);
  }

  return value;
}

export function remoteDialect(databaseId: string) {
  return remoteD1Dialect({
    accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
    apiToken: requireEnv("CLOUDFLARE_API_TOKEN"),
    databaseId,
  });
}

export async function withDb(
  fn: (db: Kysely<Database>) => Promise<void>,
  databaseId?: string,
): Promise<void> {
  if (databaseId) {
    const db = createDb<Database>(remoteDialect(databaseId));
    await fn(db);
    await db.destroy();
    return;
  }

  const { env, dispose } = await getPlatformProxy<AppBindings>();
  if (!env.DB) {
    throw new Error("no DB binding in wrangler config");
  }

  const db = createDb<Database>(d1MigrationDialect(env.DB));
  await fn(db);
  await db.destroy();
  await dispose();
}
