import { readFileSync } from "node:fs";
import path from "node:path";
import { type CAC, cac } from "cac";
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

const { version } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };

/** Anything cac lets you hang an option on: the CLI itself, or one command. */
interface TakesOptions {
  option(
    rawName: string,
    description: string,
    config?: { default?: unknown },
  ): this;
}

/** Adds the `--config` flag, so every kit's CLI names a config the same way. */
export function configOption<Target extends TakesOptions>(
  target: Target,
): Target {
  return target.option("-c, --config <file>", "the config to read", {
    default: CONFIG_FILE,
  });
}

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

interface Options {
  config?: string;
  db?: string;
  wranglerEnv?: string;
  revertAll?: boolean;
}

function flagsOf(options: Options): Flags {
  return {
    configFile: options.config,
    db: options.db,
    wranglerEnv: options.wranglerEnv,
    revertAll: options.revertAll,
  };
}

// Global, because both commands take all three and cac folds global options
// into each command's help and parsing. --revert-all stays on migrate, which
// is what makes `seed --revert-all` an error.
function buildCli(): CAC {
  const cli = cac("acme-db");
  configOption(cli)
    .option("-d, --db <binding>", "one database it declares, not every one")
    .option(
      "-e, --wrangler-env <env>",
      "act on what is deployed to that wrangler environment",
    );

  cli
    .command("migrate [migration]", "bring a database to a migration")
    .option("--revert-all", "roll every migration back")
    .action(async (migration: string | undefined, options: Options) => {
      const flags = flagsOf(options);
      await migrate(await select(flags), migration, flags);
    });

  cli
    .command("seed", "insert the rows an empty deployment needs")
    .action(async (options: Options) => {
      const flags = flagsOf(options);
      await seed(await select(flags), flags);
    });

  cli.help();
  cli.version(version);
  return cli;
}

/**
 * Runs one command and answers the exit code, without touching the process.
 *
 * @param argv - Arguments after the command name, as `process.argv.slice(2)`.
 */
export async function run(argv: string[]): Promise<number> {
  const cli = buildCli();
  try {
    // Parsing prints help or the version itself; running is ours to do, so the
    // action's promise is awaited rather than left dangling.
    cli.parse(["node", "acme-db", ...argv], { run: false });
    if (cli.options.help || cli.options.version) {
      return 0;
    }
    if (!cli.matchedCommand) {
      cli.outputHelp();
      return 1;
    }
    await cli.runMatchedCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }

  return 0;
}
