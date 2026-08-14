import type { KitCli } from "@acme/app/cli";
import type { Command } from "cac";
import type { Kysely } from "kysely";
import { NO_MIGRATIONS } from "kysely/migration";
import { createMigrator } from "../internal/migrator";
import type { AnyDatabaseConfig } from "../kit";
import { withDb } from "./with-db";

interface Options {
  db?: string;
  wranglerEnv?: string;
  revertAll?: boolean;
}

function select(
  declared: AnyDatabaseConfig[],
  binding: string | undefined,
): AnyDatabaseConfig[] {
  if (declared.length === 0) {
    throw new Error("no databases are declared");
  }

  if (binding === undefined) {
    return declared;
  }

  const one = declared.find((entry) => entry.binding === binding);
  if (!one) {
    const bindings = declared.map((entry) => entry.binding).join(", ");
    throw new Error(`no database bound to ${binding}: ${bindings}`);
  }

  return [one];
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
  options: Options,
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
    const { binding, migrations = {} } = entry;
    const names = Object.keys(migrations).toSorted();
    const last = names.at(-1);
    if (!last) {
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

async function seed(chosen: AnyDatabaseConfig[], options: Options) {
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
      entry,
      options,
      seeder as (db: Kysely<unknown>) => Promise<void>,
    );
  });
}

// On each command rather than the CLI: a kit is handed `command` alone, and
// cannot declare a global the way `acme-db` used to.
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
export default function commands({ cli, config }: KitCli): void {
  const declared = (config as AnyDatabaseConfig[] | undefined) ?? [];

  targeting(
    cli.command("migrate [migration]", "bring a database to a migration"),
  )
    // Here and not on `seed`, which is what makes `seed --revert-all` an error.
    .option("--revert-all", "roll every migration back")
    .action(async (migration: string | undefined, options: Options) => {
      await migrate(select(declared, options.db), migration, options);
    });

  targeting(
    cli.command("seed", "insert the rows an empty deployment needs"),
  ).action(async (options: Options) => {
    await seed(select(declared, options.db), options);
  });
}
