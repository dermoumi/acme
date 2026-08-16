import type { Kysely } from "kysely";

/** Which deployment of a binding to act on. */
export interface BindingOptions {
  /** Wrangler environment to reach. Its absence means act locally. */
  wranglerEnv?: string;
}

/**
 * Opens one of the app's databases by binding, and closes it afterwards.
 *
 * What the database kit registers under `withDatabase`, already bound to the
 * databases the app declared, so a command names a binding and nothing else:
 *
 * ```ts
 * const withDatabase = require<WithDatabase>("withDatabase");
 * await withDatabase<Database>("DATABASE", options, async (db) => { ... });
 * ```
 */
export interface WithDatabase {
  <DB>(
    binding: string,
    options: BindingOptions,
    run: (db: Kysely<DB>) => Promise<void>,
  ): Promise<void>;
}

declare module "@acme/app" {
  interface KitShared {
    withDatabase: WithDatabase;
  }
}
