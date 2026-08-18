/// <reference types="hono" />
import type { Kit } from "@acme/app";
import type { Kysely } from "kysely";
import {
  type Accessors,
  buildGetDb,
  type GetDb,
  openDbAccessors,
} from "./get-db";

// What this kit puts on every request, declared beside the `vars` that puts it
// there, so a route reads ctx.var.getDb with nothing to import.
declare module "hono" {
  interface ContextVariableMap {
    getDb: GetDb;
  }
}

/**
 * What the database kit calls itself, for whoever looks it up in a config.
 */
export const KIT_NAME = "database";

/**
 * An object rather than the accessors alone, so what it keeps next joins it.
 */
export interface DatabaseContext {
  /**
   * One per declared database, holding the connections requests use.
   */
  accessors: Accessors;
}

/**
 * What a seed module default-exports.
 *
 * ```ts
 * const seedUsers: Seed<Database> = async (db) => { ... };
 * export default seedUsers;
 * ```
 *
 * Annotate the app's seed with it: the config names the module by path, so
 * nothing else checks that what it exports is shaped like a seed.
 */
export type Seed<DB = unknown> = (db: Kysely<DB>) => Promise<void>;

/** One database an app declares. */
export interface DatabaseConfig {
  /** The D1 binding, matching what the app passed `defineDb`. */
  binding: string;
  /** Env var holding the url. Defaults to `${binding}_URL`. */
  urlVar?: string;
  /**
   * Where this database's migrations live, as a specifier the CLI imports.
   * The module's default export is its {@link Migrations}.
   *
   * A specifier rather than the record itself, for the reason `Kit.cli` is one:
   * `acme.config.ts` is imported by the app as well as the CLI, and a value
   * here would carry every migration into the app's bundle forever, where
   * nothing runs them. Written by the app, pointing at itself:
   * `new URL("./src/server/db/migrator.ts", import.meta.url).href`
   */
  migrations?: string;
  /**
   * Where the rows an empty deployment needs live, as a specifier the CLI
   * imports. The module's default export is its {@link Seed}. Run by
   * `acme seed`, and a specifier for the same reason `migrations` is.
   */
  seed?: string;
}

function checkDuplicates(databases: DatabaseConfig[]): DatabaseConfig[] {
  // Every reader, not just those that go on to pick one: a duplicate would
  // otherwise resolve silently to whichever came first.
  const names = databases.map((entry) => entry.binding);
  const duplicate = names.find((name, at) => names.indexOf(name) !== at);
  if (duplicate) {
    throw new Error(`${duplicate} is declared more than once`);
  }

  return databases;
}

/**
 * The database kit, taking every database the app has at once.
 *
 * An app declares it once, however many databases it holds, because a command
 * such as `migrate` acts on all of them unless `--db` names one.
 *
 * Every request it reaches gets a `getDb`, over connections opened once.
 *
 * @param databases - The app's databases, in the order they migrate.
 * @throws If two of them claim the same binding.
 */
export function databaseKit(databases: DatabaseConfig[]): Kit {
  const config = checkDuplicates(databases);
  const accessors = openDbAccessors(config);

  return {
    name: KIT_NAME,
    config,
    context: { accessors } satisfies DatabaseContext,
    cli: new URL("../commands/commands.ts", import.meta.url).href,
    vars: (env) => {
      return { getDb: buildGetDb(accessors, env) };
    },
  };
}
