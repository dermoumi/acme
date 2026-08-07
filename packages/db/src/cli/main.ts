import { parseArgs } from "node:util";
import type { Kysely } from "kysely";
import { NO_MIGRATIONS } from "kysely/migration";
import { createMigrator } from "../internal/migrator";
import {
  type AnyDatabaseConfig,
  CONFIG_FILE,
  databases,
  loadAcmeConfig,
} from "./config";
import { withDb } from "./with-db";

const USAGE = `usage: acme-db <command> [migration] [options]

  migrate [migration]   move a database to a migration, applying or rolling
                        back as needed. Defaults to the last one declared.
  migrate --revert-all  roll every migration back.
  seed                  insert the rows an empty deployment needs

  -c, --config <file>   the config to read, ${CONFIG_FILE} by default
  --db <binding>        one database it declares, rather than every one
  --wrangler-env <env>  act on what is deployed to that wrangler environment,
                        taking each D1 id from wrangler.jsonc. Without it,
                        everything is local.`;

interface Flags {
  db?: string;
  wranglerEnv?: string;
  revertAll?: boolean;
  /** Path to acme.config.ts. Defaults to the one in the working directory. */
  configFile?: string;
}

async function select(flags: Flags): Promise<AnyDatabaseConfig[]> {
  const binding = flags.db;
  const file = flags.configFile ?? CONFIG_FILE;
  const db = databases(await loadAcmeConfig(flags.configFile));
  if (db.length === 0) {
    throw new Error(`${file} declares no databases`);
  }

  const bindings = db.map((entry) => entry.binding);
  const duplicate = bindings.find((name, at) => bindings.indexOf(name) !== at);
  if (duplicate) {
    throw new Error(`${file} declares ${duplicate} twice`);
  }
  if (binding === undefined) {
    return db;
  }

  const one = db.find((entry) => entry.binding === binding);
  if (!one) {
    throw new Error(`no database bound to ${binding}: ${bindings.join(", ")}`);
  }

  return [one];
}

// A migration name means nothing across two schemas.
function requireOne(chosen: AnyDatabaseConfig[], what: string) {
  if (chosen.length > 1) {
    throw new Error(`--db is required: ${what} acts on one database`);
  }
}

// Sequential on purpose: one connection, and one wrangler proxy, at a time.
async function forEach(
  chosen: AnyDatabaseConfig[],
  each: (entry: AnyDatabaseConfig) => Promise<void>,
) {
  for (const entry of chosen) {
    // oxlint-disable-next-line no-await-in-loop
    await each(entry);
  }
}

async function migrate(
  chosen: AnyDatabaseConfig[],
  migration: string | undefined,
  flags: Flags,
) {
  if (migration !== undefined && flags.revertAll) {
    throw new Error("a migration and --revert-all are exclusive");
  }
  if (migration !== undefined) {
    requireOne(chosen, "a migration");
  }
  if (flags.revertAll) {
    requireOne(chosen, "--revert-all");
  }

  await forEach(chosen, async (entry) => {
    const { binding, migrations } = entry;
    const names = Object.keys(migrations ?? {}).toSorted();
    const last = names.at(-1);
    if (!migrations || !last) {
      if (chosen.length === 1) {
        throw new Error(`${binding} declares no migrations`);
      }
      return;
    }
    if (migration !== undefined && !names.includes(migration)) {
      throw new Error(
        `${binding} has no migration named "${migration}": ${names.join(", ")}`,
      );
    }

    await withDb(entry.binding, flags, async (db) => {
      // Both directions: kysely rolls back when the target is behind.
      const { error, results } = await createMigrator(db, migrations).migrateTo(
        flags.revertAll ? NO_MIGRATIONS : (migration ?? last),
      );
      for (const { status, direction, migrationName } of results ?? []) {
        console.log(`${binding}: ${status} ${direction} ${migrationName}`);
      }
      if (error) {
        throw error instanceof Error
          ? error
          : new Error(`${binding}: migration failed`, { cause: error });
      }
    });
  });
}

async function seed(chosen: AnyDatabaseConfig[], flags: Flags) {
  await forEach(chosen, async (entry) => {
    const seeder = entry.seed;
    if (!seeder) {
      if (chosen.length === 1) {
        throw new Error(`${entry.binding} declares no seed`);
      }
      return;
    }

    // The schema is the app's business: `defineDbConfig` already checked the
    // seed against it, and nothing here can know it.
    await withDb(
      entry.binding,
      flags,
      seeder as (db: Kysely<unknown>) => Promise<void>,
    );
  });
}

function parse(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      config: { type: "string", short: "c" },
      db: { type: "string" },
      "wrangler-env": { type: "string" },
      "revert-all": { type: "boolean" },
    },
    allowPositionals: true,
  });
  if (positionals.length > 2) {
    throw new Error("too many arguments");
  }
  const [command, migration] = positionals;

  return {
    command,
    migration,
    flags: {
      configFile: values.config,
      db: values.db,
      wranglerEnv: values["wrangler-env"],
      revertAll: values["revert-all"],
    },
  };
}

/**
 * Runs one command and answers the exit code, without touching the process.
 *
 * @param argv - Arguments after the command name, as `process.argv.slice(2)`.
 */
export async function run(argv: string[]): Promise<number> {
  try {
    const { command, migration, flags } = parse(argv);
    const migrateOnly = migration !== undefined || flags.revertAll;
    if (command === "migrate") {
      await migrate(await select(flags), migration, flags);
    } else if (command === "seed" && !migrateOnly) {
      await seed(await select(flags), flags);
    } else {
      console.error(USAGE);
      return 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }

  return 0;
}
