import type { Kysely } from "kysely";
import { d1MigrationDialect, remoteD1Dialect } from "../d1";
import { createDb } from "../database";
import { urlVarFor } from "../db/url-var";
import { dialectFromUrl } from "../uri/uri.node.ts";
import type { BindingOptions } from "../shared";
import type { DatabaseConfig } from "../kit";

// One value per name, in the same positions, so a caller can destructure.
type EnvValues<Keys extends string[]> = { [Index in keyof Keys]: string };

// All of them at once: being told about the second only after fixing the first
// is a round trip the user should not have to make.
function requireEnvVars<Keys extends string[]>(...keys: Keys): EnvValues<Keys> {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`${missing.join(" and ")} must be set`);
  }

  return keys.map((key) => process.env[key]) as EnvValues<Keys>;
}

// Only the D1 paths need wrangler, so an app that never takes one does not
// have to install it.
async function localD1<DB>(binding: string) {
  const wrangler = await import("wrangler").catch((cause: unknown) => {
    throw new Error("@acme/db needs wrangler to reach a D1", { cause });
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
  const fromEnv = process.env[`${binding}_ID`];
  if (fromEnv) {
    return fromEnv;
  }

  // Otherwise wrangler.jsonc holds it, one per environment.
  const wrangler = await import("wrangler").catch((cause: unknown) => {
    throw new Error("@acme/db needs wrangler to reach a D1", { cause });
  });
  const declared = d1Databases(wrangler.unstable_readConfig({ env })).find(
    (database) => database.binding === binding,
  );
  if (!declared?.database_id) {
    const message = `no id for ${binding}: set ${binding}_ID, or declare the D1 in wrangler.jsonc for ${env}`;
    throw new Error(message);
  }

  return declared.database_id;
}

// Answers what went wrong rather than throwing, so cleanup can carry on.
async function failureGuard(work: Promise<void> | undefined): Promise<unknown> {
  try {
    await work;

    return undefined;
  } catch (error) {
    return error;
  }
}

// Only the local D1 has anything to tear down beyond the connection.
interface DbHandle<DB> {
  db: Kysely<DB>;
  dispose?: () => Promise<void>;
}

async function open<DB>(
  config: DatabaseConfig,
  options: BindingOptions,
): Promise<DbHandle<DB>> {
  const { binding } = config;
  const { wranglerEnv } = options;
  if (wranglerEnv !== undefined) {
    const [accountId, apiToken] = requireEnvVars(
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
    );

    const databaseId = await remoteD1Id(binding, wranglerEnv);
    const dialect = remoteD1Dialect({ accountId, apiToken, databaseId });
    return { db: createDb<DB>(dialect) };
  }

  const url = process.env[urlVarFor(binding, config.urlVar)];
  if (url) {
    const dialect = await dialectFromUrl(url);
    return { db: createDb<DB>(dialect) };
  }

  return localD1<DB>(binding);
}

// A wrangler environment takes the D1 id from wrangler.jsonc. Without one it is
// local: the url env var first, then the D1 wrangler serves.
export async function withDb<DB>(
  config: DatabaseConfig,
  options: BindingOptions,
  run: (db: Kysely<DB>) => Promise<void>,
): Promise<void> {
  const { db, dispose } = await open<DB>(config, options);

  let failed: unknown;
  try {
    await run(db);
  } catch (error) {
    failed = error;
  }

  // Every step regardless of the ones before it: skipping dispose leaves the
  // workerd process it owns holding the command open.
  const closed = await failureGuard(db.destroy());
  const disposed = await failureGuard(dispose?.());
  const error = failed ?? closed ?? disposed;
  if (error !== undefined) {
    throw error instanceof Error
      ? error
      : new Error("the database could not be used", { cause: error });
  }
}
