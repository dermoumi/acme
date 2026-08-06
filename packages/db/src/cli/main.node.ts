import { parseArgs } from "node:util";
import type { Kysely } from "kysely";
import { NO_MIGRATIONS } from "kysely/migration";
import { createMigrator } from "../internal/migrator";
import {
  type AnyDatabaseConfig,
  CONFIG_FILE,
  loadAcmeConfig,
} from "./config.node";
import { withDb } from "./open.node";

const USAGE = `usage: acme-db <command> [database-id] [options]

  migrate [--target <migration>]  move the database to a migration, applying
                                  or rolling back as needed. Defaults to the
                                  last one declared.
  migrate --revert-all            roll every migration back.
  seed                            insert the rows an empty deployment needs

  omit the database id to use the local D1, or set the url env var to reach
  a node database instead`;

interface Target {
  target?: string;
  revertAll?: boolean;
}

async function dbConfig(): Promise<AnyDatabaseConfig> {
  const { db } = await loadAcmeConfig();
  if (!db) {
    throw new Error(`${CONFIG_FILE} has no \`db\` section`);
  }

  return db;
}

async function migrate(
  config: AnyDatabaseConfig,
  id: string | undefined,
  { target, revertAll }: Target,
) {
  const { migrations } = config;
  const names = Object.keys(migrations ?? {}).toSorted();
  const last = names.at(-1);
  if (!migrations || !last) {
    throw new Error(`${CONFIG_FILE} declares no migrations for db`);
  }
  if (target !== undefined && revertAll) {
    throw new Error("--target and --revert-all are exclusive");
  }
  // No name is reserved: every --target is a migration, and reverting
  // everything has its own flag, so a migration may be called anything.
  if (target !== undefined && !names.includes(target)) {
    throw new Error(`no migration named "${target}": ${names.join(", ")}`);
  }

  await withDb(config, id, async (db) => {
    // Both directions: kysely rolls back when the target is behind.
    const { error, results } = await createMigrator(db, migrations).migrateTo(
      revertAll ? NO_MIGRATIONS : (target ?? last),
    );
    for (const result of results ?? []) {
      console.log(
        `${result.status}: ${result.direction} ${result.migrationName}`,
      );
    }
    if (error) {
      throw error instanceof Error
        ? error
        : new Error("migration failed", { cause: error });
    }
  });
}

async function seed(config: AnyDatabaseConfig, id?: string) {
  const { seed: run } = config;
  if (!run) {
    throw new Error(`${CONFIG_FILE} declares no seed for db`);
  }

  // The schema is the app's business: `defineDbConfig` already checked the
  // seed against it, and nothing here can know it.
  await withDb(config, id, run as (db: Kysely<unknown>) => Promise<void>);
}

function parse() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      target: { type: "string" },
      "revert-all": { type: "boolean" },
    },
    allowPositionals: true,
  });
  if (positionals.length > 2) {
    throw new Error("too many arguments");
  }
  const [command, databaseId] = positionals;

  return {
    command,
    databaseId,
    target: values.target,
    revertAll: values["revert-all"],
  };
}

try {
  const { command, databaseId, target, revertAll } = parse();
  const plain = target === undefined && !revertAll;
  if (command === "migrate") {
    await migrate(await dbConfig(), databaseId, { target, revertAll });
  } else if (command === "seed" && plain) {
    await seed(await dbConfig(), databaseId);
  } else {
    console.error(USAGE);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
