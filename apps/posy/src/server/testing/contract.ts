import type { Kysely } from "kysely";
import type { Database } from "../db";
import type { GateBindings } from "../gate";

// Both runtimes bind these: tests import them and never learn which one they run on.
export type CreateBindings = (
  overrides?: Partial<GateBindings>,
) => GateBindings;

// A database with no schema applied: the same starting point on either runtime.
export type CreateEmptyDb = () => Promise<Kysely<Database>>;
