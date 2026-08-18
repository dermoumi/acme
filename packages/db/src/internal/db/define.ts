import { resolveDialect } from "#runtime";
import type { Kysely } from "kysely";
import { createDb } from "../database";

export interface DatabaseOptions {
  /**
   * Env var holding the url, on node. Defaults to the binding name with `_URL`
   * appended, so `defineDb("DATABASE")` reads `DATABASE_URL`. Never read on
   * workerd, which takes the binding straight off `env`.
   */
  urlVar?: string;
}

/**
 * Hands a request its database. Build one with {@link defineDb}.
 */
export interface DatabaseAccessor<DB> {
  (ctx: { env: unknown }): Promise<Kysely<DB>>;
  /**
   * Closes what it holds and forgets it, so the next call opens again.
   *
   * For tests: an accessor caches for the life of the process, and a suite
   * wanting a private database per case resets between them.
   */
  clear: () => Promise<void>;
}

/**
 * Names a database, without opening it.
 *
 * Call it once at module scope. Nothing is read or connected until a request
 * arrives and a handler asks, which is what keeps a Worker's startup empty. The
 * database is then held for the life of the process, since the binding and the
 * url are fixed for a deployment.
 *
 * @param binding The D1 binding on `env`, used on workerd.
 * @throws Error, on first use, when the environment names neither.
 */
export function defineDb<DB>(
  binding: string,
  options: DatabaseOptions = {},
): DatabaseAccessor<DB> {
  let cached: Promise<Kysely<DB>> | undefined;

  // Async so a runtime that refuses the env rejects, rather than throwing past
  // the caller's await.
  async function open(env: unknown): Promise<Kysely<DB>> {
    const dialect = await resolveDialect(env, binding, options.urlVar);
    return createDb<DB>(dialect);
  }

  return Object.assign(
    (ctx: { env: unknown }) => {
      // Cleared on failure, so a transient one cannot disable the accessor for
      // the life of the process.
      cached ??= open(ctx.env).catch((error: unknown) => {
        cached = undefined;
        throw error;
      });

      return cached;
    },
    {
      clear: async () => {
        const pending = cached;
        cached = undefined;
        // A rejected cache has nothing to close, and rethrowing here would fail
        // the test that is trying to clean up after it.
        await pending?.then((db) => db.destroy()).catch(() => undefined);
      },
    },
  );
}
