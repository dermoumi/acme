import type { Kysely } from "kysely";
import { d1MigrationDialect, remoteD1Dialect } from "../d1";
import { createDb } from "../internal/database";
import { urlVarFor } from "../internal/db/url-var.node";
import { dialectFromUrl } from "../internal/uri/uri.node";
import { databaseTarget, loadAcmeConfig } from "./config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} must be set`);
  }

  return value;
}

// Only the D1 paths need wrangler, so an app that never takes one does not
// have to install it.
async function localD1<DB>(binding: string) {
  const wrangler = await import("wrangler").catch((cause: unknown) => {
    throw new Error("acme-db needs wrangler to reach a D1", { cause });
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

interface D1Declaration {
  binding: string;
  database_id?: string;
}

// Restated, and taken through `unknown`: wrangler is an optional peer, so a
// project without its types sees the config as `any`.
function d1Databases(config: unknown): D1Declaration[] {
  return (config as { d1_databases?: D1Declaration[] }).d1_databases ?? [];
}

// `${binding}_ID` wins because a deploy resolves the id itself, and may patch
// it into a built config wrangler.jsonc knows nothing about.
async function remoteD1Id(binding: string, env: string): Promise<string> {
  const fromEnv = process.env[`${binding.toUpperCase()}_ID`];
  if (fromEnv) {
    return fromEnv;
  }

  // Otherwise wrangler.jsonc holds it, one per environment.
  const wrangler = await import("wrangler").catch((cause: unknown) => {
    throw new Error("acme-db needs wrangler to reach a D1", { cause });
  });
  const declared = d1Databases(wrangler.unstable_readConfig({ env })).find(
    (database) => database.binding === binding,
  );
  if (!declared?.database_id) {
    throw new Error(
      `no id for ${binding}: set ${binding.toUpperCase()}_ID, or declare the` +
        ` D1 in wrangler.jsonc for ${env}`,
    );
  }

  return declared.database_id;
}

export interface OpenOptions {
  /** Wrangler environment to reach. Its absence means act locally. */
  wranglerEnv?: string;
  /** Path to acme.config.ts. Defaults to the one in the working directory. */
  configFile?: string;
}

/**
 * Opens the database named by a binding, and closes it afterwards.
 *
 * A wrangler environment takes the D1 id from wrangler.jsonc. Without one it
 * is local: the url env var first, which is how a node deployment migrates,
 * then the D1 wrangler serves.
 */
export async function withDb<DB>(
  binding: string,
  options: OpenOptions,
  run: (db: Kysely<DB>) => Promise<void>,
): Promise<void> {
  const { wranglerEnv } = options;
  if (wranglerEnv !== undefined) {
    const db = createDb<DB>(
      remoteD1Dialect({
        accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
        apiToken: requireEnv("CLOUDFLARE_API_TOKEN"),
        databaseId: await remoteD1Id(binding, wranglerEnv),
      }),
    );
    await run(db);
    await db.destroy();
    return;
  }

  const target = await databaseTarget(
    binding,
    await loadAcmeConfig(options.configFile),
  );
  const url = process.env[urlVarFor(binding, target.urlVar)];
  if (url) {
    const db = createDb<DB>(await dialectFromUrl(url));
    await run(db);
    await db.destroy();
    return;
  }

  const { db, dispose } = await localD1<DB>(binding);
  await run(db);
  await db.destroy();
  await dispose();
}
