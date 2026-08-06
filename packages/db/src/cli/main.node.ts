import { parseArgs } from "node:util";
import type { Kysely } from "kysely";
import { NO_MIGRATIONS } from "kysely/migration";
import { createMigrator } from "../internal/migrator";
import {
  type AnyDatabaseConfig,
  CONFIG_FILE,
  databases,
  loadAcmeConfig,
} from "./config.node";
import { withDb } from "./open.node";

const USAGE = `usage: acme-db <command> [migration] [options]

  migrate [migration]    move a database to a migration, applying or rolling
                         back as needed. Defaults to the last one declared.
  migrate --revert-all   roll every migration back.
  seed                   insert the rows an empty deployment needs

  --db <binding>         one database ${CONFIG_FILE} declares, on this machine
  --remote-db <binding>  the same database deployed on Cloudflare, taking its
                         D1 id from wrangler.jsonc. CLOUDFLARE_ENV picks the
                         environment.

  with neither, every declared database is used, on this machine.`;

interface Flags {
  db?: string;
  remoteDb?: string;
  revertAll?: boolean;
}

async function select(flags: Flags): Promise<AnyDatabaseConfig[]> {
  if (flags.db !== undefined && flags.remoteDb !== undefined) {
    throw new Error("--db and --remote-db are exclusive");
  }
  const binding = flags.db ?? flags.remoteDb;
  const db = databases(await loadAcmeConfig());
  if (db.length === 0) {
    throw new Error(`${CONFIG_FILE} declares no databases`);
  }

  const bindings = db.map((entry) => entry.binding);
  const duplicate = bindings.find((name, at) => bindings.indexOf(name) !== at);
  if (duplicate) {
    throw new Error(`${CONFIG_FILE} declares ${duplicate} twice`);
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
  run: (entry: AnyDatabaseConfig) => Promise<void>,
) {
  for (const entry of chosen) {
    // oxlint-disable-next-line no-await-in-loop
    await run(entry);
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
  const remote = flags.remoteDb !== undefined;

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

    await withDb(entry.binding, { remote }, async (db) => {
      // Both directions: kysely rolls back when the target is behind.
      const { error, results } = await createMigrator(db, migrations).migrateTo(
        flags.revertAll ? NO_MIGRATIONS : (migration ?? last),
      );
      for (const result of results ?? []) {
        console.log(
          `${binding}: ${result.status} ${result.direction} ${result.migrationName}`,
        );
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
  const remote = flags.remoteDb !== undefined;

  await forEach(chosen, async (entry) => {
    const run = entry.seed;
    if (!run) {
      if (chosen.length === 1) {
        throw new Error(`${entry.binding} declares no seed`);
      }
      return;
    }

    // The schema is the app's business: `defineDbConfig` already checked the
    // seed against it, and nothing here can know it.
    await withDb(
      entry.binding,
      { remote },
      run as (db: Kysely<unknown>) => Promise<void>,
    );
  });
}

function parse() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      db: { type: "string" },
      "remote-db": { type: "string" },
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
      db: values.db,
      remoteDb: values["remote-db"],
      revertAll: values["revert-all"],
    },
  };
}

try {
  const { command, migration, flags } = parse();
  const migrateOnly = migration !== undefined || flags.revertAll;
  if (command === "migrate") {
    await migrate(await select(flags), migration, flags);
  } else if (command === "seed" && !migrateOnly) {
    await seed(await select(flags), flags);
  } else {
    console.error(USAGE);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
