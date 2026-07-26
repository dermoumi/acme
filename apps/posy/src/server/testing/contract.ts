import type { GateBindings } from "../gate";

// Both runtimes bind this: tests import it and never learn which one they run on.
export type CreateBindings = (
  overrides?: Partial<GateBindings>,
) => GateBindings;
