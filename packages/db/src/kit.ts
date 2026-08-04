import { createDialectResolver } from "#runtime";
import type { Dialect, Kysely } from "kysely";
import { createDb } from "./database";

/** Cloudflare's conventional D1 binding name. */
const DEFAULT_BINDING = "DB";

export interface DbKitOptions {
  /**
   * Where the database lives, on node: `:memory:`, `file:...`, or
   * `postgres:...`. Ignored on workerd, which reads a binding instead.
   */
  url?: string;
  /** Name of the D1 binding on `env`, on workerd. Defaults to `DB`. */
  binding?: string;
  /**
   * A ready-made dialect, which wins over everything else. For tests and for
   * engines the kit does not resolve itself.
   */
  dialect?: Dialect;
}

/** Hands out the app's database. Build one with {@link createDbKit}. */
export interface DbKit<DB> {
  /**
   * The database for this request.
   *
   * On node the connection is opened once and reused, so `env` is ignored. On
   * workerd the D1 binding is read from `env` every time, because that is where
   * the platform puts it.
   */
  resolve(env?: unknown): Promise<Kysely<DB>>;
}

/**
 * Resolves the app's database without app code knowing which engine it got.
 *
 * Build one per app and pass it down; the runtime decides how `resolve` answers.
 * A failed connection is not cached, so a transient failure does not disable the
 * kit for the life of the process.
 */
export function createDbKit<DB>(options: DbKitOptions = {}): DbKit<DB> {
  const resolveDialect = createDialectResolver({
    url: options.url,
    binding: options.binding ?? DEFAULT_BINDING,
  });
  // Keyed on the dialect so node reuses one Kysely over its one connection
  // while workerd, handed a fresh dialect per request, gets a fresh one.
  const built = new WeakMap<Dialect, Kysely<DB>>();

  return {
    async resolve(env = {}) {
      const dialect = options.dialect ?? (await resolveDialect(env));
      const existing = built.get(dialect);
      if (existing) return existing;

      const db = createDb<DB>(dialect);
      built.set(dialect, db);
      return db;
    },
  };
}
