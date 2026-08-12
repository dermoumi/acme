import type { AppBindings } from "../../bindings";

// Both runtimes bind these: tests import them and never learn which one they
// run on. The database is @acme/db's business, not posy's.
export type CreateBindings = (overrides?: Partial<AppBindings>) => AppBindings;
