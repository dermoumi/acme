/// <reference types="hono" />
import type { Kit } from "@acme/app";
import type { Kysely } from "kysely";
import { contextFor } from "./context";
import { buildGetDb, type GetDb } from "../db";

// What this kit puts on every request, declared beside the `vars` that puts it
// there, so a route reads ctx.var.getDb with nothing to import.
declare module "hono" {
  interface ContextVariableMap {
    getDb: GetDb;
  }
}

/**
 * What a seed module default-exports.
 *
 * Annotate the app's seed with it: the config names the module by path, so
 * nothing else checks that what it exports is shaped like a seed.
 */
export type Seed<DB = unknown> = (db: Kysely<DB>) => Promise<void>;

/**
 * One database an app declares.
 */
export interface DatabaseConfig {
  /**
   * The D1 binding, as passed to `defineDb`.
   */
  binding: string;
  /**
   * Env var holding the url. Defaults to `${binding}_URL`.
   */
  urlVar?: string;
  /**
   * Where this database's migrations live, as a specifier the CLI imports.
   * The module's default export is its {@link Migrations}.
   *
   * A specifier for the reason `Kit.commands` is one: `acme.config.ts` reaches
   * the app too, and a value here would carry every migration into its bundle,
   * where nothing runs them. The app points at itself:
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
 * An app declares it once, however many databases it holds: a command such as
 * `migrate` acts on all of them unless `--db` names one.
 *
 * @param databases In the order they migrate.
 * @throws If two of them claim the same binding.
 */
export function databaseKit(databases: DatabaseConfig[]): Kit {
  const config = checkDuplicates(databases);

  return {
    name: "@acme/db",
    config,
    commands: "@acme/db/commands",
    init: () => {
      const { accessors } = contextFor(config);

      return {
        vars: (env) => {
          return { getDb: buildGetDb(accessors, env) };
        },
      };
    },
  };
}
