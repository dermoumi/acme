import type { Kysely } from "kysely";
import type { DatabaseConfig } from "../kit/kit";
import { type DatabaseAccessor, defineDb } from "./define";

/**
 * The databases an app declares, keyed by the binding naming each.
 *
 * Empty here: an app fills it in beside the schema it names, so `getDb` knows
 * both which databases exist and what shape each one holds.
 *
 * ```ts
 * declare module "@acme/db" {
 *   interface Databases {
 *     DATABASE: Database;
 *   }
 * }
 * ```
 */
// oxlint-disable-next-line no-empty-object-type
export interface Databases {}

/**
 * Hands a request one of the app's databases, by the binding naming it.
 */
export type GetDb = <Name extends keyof Databases>(
  name: Name,
) => Promise<Kysely<Databases[Name]>>;

/**
 * One accessor per declared database, keyed by binding.
 */
export type Accessors = ReadonlyMap<string, DatabaseAccessor<unknown>>;

/**
 * Opens an accessor per database, without connecting to any of them.
 *
 * Call it once, where the kit is declared. Each accessor caches for the life of
 * the process, and that cache is what keeps a node host to a single connection
 * pool instead of one per request.
 *
 * @param config The app's databases, already checked for duplicates.
 */
export function openDbAccessors(config: readonly DatabaseConfig[]): Accessors {
  return new Map(
    config.map((entry) => [
      entry.binding,
      defineDb<unknown>(entry.binding, { urlVar: entry.urlVar }),
    ]),
  );
}

/**
 * Hands one request its databases, over accessors already opened.
 *
 * @param accessors What {@link openDbAccessors} answered, built once.
 * @param env Everything this request's host knows.
 */
export function buildGetDb(accessors: Accessors, env: unknown): GetDb {
  // Cast because the name decides the schema, which only the app's Databases
  // knows; every caller reaches this through that declaration.
  return ((name: string) => {
    const accessor = accessors.get(name);
    if (!accessor) {
      const known = [...accessors.keys()].join(", ");
      const message = `no database bound to ${name}${known ? `: ${known}` : ""}`;
      throw new Error(message);
    }

    return accessor({ env });
  }) as GetDb;
}
