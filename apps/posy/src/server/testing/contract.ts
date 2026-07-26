import type { Dialect, Kysely } from "kysely";
import type { Database } from "../db";
import type { GateBindings } from "../gate";

// Both runtimes bind these: tests import them and never learn which one they run on.
export type CreateBindings = (
  overrides?: Partial<GateBindings>,
) => GateBindings;

// Empty schema, either runtime. createApp() takes the dialect, not the Kysely.
export type CreateEmptyDialect = () => Promise<Dialect>;

export type CreateEmptyDb = () => Promise<Kysely<Database>>;
