import type { Dialect, Kysely } from "kysely";
import type { AppBindings } from "../../bindings";
import type { Database } from "../../db";

// Both runtimes bind these: tests import them and never learn which one they run on.
export type CreateBindings = (overrides?: Partial<AppBindings>) => AppBindings;

// Empty schema, either runtime. createApp() takes the dialect, not the Kysely.
export type CreateEmptyDialect = () => Promise<Dialect>;

export type CreateEmptyDb = () => Promise<Kysely<Database>>;
