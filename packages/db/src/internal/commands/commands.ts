import type { KitCli } from "@acme/app/cli";
import type { Command } from "cac";
import { NO_MIGRATIONS } from "kysely/migration";
import { createMigrator } from "../migrator";
import type { WithDatabase } from "../shared";
import type { DatabaseConfig } from "../kit";
import { loadMigrations, loadSeed, type Resolve } from "./load";
import { withDb } from "./with-db";

interface Options {
  db?: string;
  wranglerEnv?: string;
  revertAll?: boolean;
}

function one(declared: DatabaseConfig[], binding: string): DatabaseConfig {
  const found = declared.find((entry) => entry.binding === binding);
  if (!found) {
    const known = declared.map((entry) => entry.binding).join(", ");
    const message = `no database bound to ${binding}${known ? `: ${known}` : ""}`;
    throw new Error(message);
  }

  return found;
}

function select(
  declared: DatabaseConfig[],
  binding: string | undefined,
): DatabaseConfig[] {
  if (declared.length === 0) {
    throw new Error("no databases are declared");
  }

  return binding === undefined ? declared : [one(declared, binding)];
}

// Sequential on purpose: one connection, and one wrangler proxy, at a time.
async function forEach(
  chosen: DatabaseConfig[],
  each: (entry: DatabaseConfig) => Promise<void>,
) {
  for (const entry of chosen) {
    // oxlint-disable-next-line no-await-in-loop
    await each(entry);
  }
}

async function migrate(
  chosen: DatabaseConfig[],
  migration: string | undefined,
  options: Options,
  resolve: Resolve,
) {
  if (migration !== undefined && options.revertAll) {
    throw new Error("a migration and --revert-all are exclusive");
  }
  // Only a name: it may not exist in the next database, or may mean something
  // else there. --revert-all is NO_MIGRATIONS, which every schema understands.
  if (migration !== undefined && chosen.length > 1) {
    throw new Error("--db is required: a migration acts on one database");
  }

  await forEach(chosen, async (entry) => {
    const { binding } = entry;
    const migrations = await loadMigrations(entry, resolve);
    const names = Object.keys(migrations).toSorted();
    const last = names.at(-1);
    if (!last) {
      if (chosen.length === 1) {
        throw new Error(`${binding} declares no migrations`);
      }
      return;
    }

    if (migration !== undefined && !names.includes(migration)) {
      const message = `${binding} has no migration named "${migration}": ${names.join(", ")}`;
      throw new Error(message);
    }

    await withDb(entry, options, async (db) => {
      // Both directions: kysely rolls back when the target is behind.
      const { error, results } = await createMigrator(db, migrations).migrateTo(
        options.revertAll ? NO_MIGRATIONS : (migration ?? last),
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

async function seed(
  chosen: DatabaseConfig[],
  options: Options,
  resolve: Resolve,
) {
  await forEach(chosen, async (entry) => {
    const seeder = await loadSeed(entry, resolve);
    if (!seeder) {
      if (chosen.length === 1) {
        throw new Error(`${entry.binding} declares no seed`);
      }
      return;
    }

    await withDb(entry, options, seeder);
  });
}

// On each command rather than the CLI: a kit is handed `command` alone, so
// it cannot declare a global.
function targeting(command: Command): Command {
  return command
    .option("-d, --db <binding>", "one database it declares, not every one")
    .option(
      "-e, --wrangler-env <env>",
      "act on what is deployed to that wrangler environment",
    );
}

/**
 * Declares the database kit's commands on whichever CLI is mounting it.
 *
 * The default export because that is what `Kit.cli` names, and reached by URL
 * rather than by import: this module is node-only, and `acme.config.ts` is
 * imported by the app as well as the CLI.
 */
export default function commands({
  cli,
  config,
  register,
  resolve,
}: KitCli): void {
  const declared = (config as DatabaseConfig[] | undefined) ?? [];

  // Bound to what the app declared, so another kit's command names a binding
  // and never has to find the config for itself.
  const withDatabase: WithDatabase = async (binding, options, run) => {
    await withDb(one(declared, binding), options, run);
  };
  register("withDatabase", withDatabase);

  targeting(
    cli.command("migrate [migration]", "bring a database to a migration"),
  )
    // Here and not on `seed`, which is what makes `seed --revert-all` an error.
    .option("--revert-all", "roll every migration back")
    .action(async (migration: string | undefined, options: Options) => {
      await migrate(select(declared, options.db), migration, options, resolve);
    });

  targeting(
    cli.command("seed", "insert the rows an empty deployment needs"),
  ).action(async (options: Options) => {
    await seed(select(declared, options.db), options, resolve);
  });
}
