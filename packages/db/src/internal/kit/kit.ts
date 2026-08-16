import type { Kit } from "@acme/app";
import type { Kysely } from "kysely";
import type { Migrations } from "../migrator";

/** One database an app declares. */
export interface DatabaseConfig {
  /** The D1 binding, matching what the app passed `defineDb`. */
  binding: string;
  /** Env var holding the url. Defaults to `${binding}_URL`. */
  urlVar?: string;
  /** Keyed by name, in the order the keys sort. */
  migrations?: Migrations;
  /**
   * Rows an empty deployment needs. Run by `acme seed`.
   *
   * Any schema: only the app knows its own, and the seed already carries the
   * type it was written against.
   */
  // oxlint-disable-next-line no-explicit-any
  seed?: (db: Kysely<any>) => Promise<void>;
}

function checkDuplicates(bindings: DatabaseConfig[]): DatabaseConfig[] {
  // Every reader, not just those that go on to pick one: a duplicate would
  // otherwise resolve silently to whichever came first.
  const names = bindings.map((entry) => entry.binding);
  const duplicate = names.find((name, at) => names.indexOf(name) !== at);
  if (duplicate) {
    throw new Error(`${duplicate} is declared more than once`);
  }

  return bindings;
}

/**
 * The database kit, taking every database the app has at once.
 *
 * An app declares it once, however many databases it holds, because a command
 * such as `migrate` acts on all of them unless `--db` names one.
 *
 * @param bindings - The app's databases, in the order they migrate.
 * @throws If two of them claim the same binding.
 */
export function database(bindings: DatabaseConfig[]): Kit {
  return {
    name: "database",
    config: checkDuplicates(bindings),
    cli: new URL("../cli/commands.ts", import.meta.url).href,
  };
}
