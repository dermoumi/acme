import type { Limiter } from "../contract";

export interface TestBindings {
  RATE_LIMIT_TEST?: Limiter;
  RATE_LIMIT_OTHER?: Limiter;
}

// Both runtimes bind this: tests import it and never learn which one they run on.
export type CreateBindings = (
  overrides?: Partial<TestBindings>,
) => TestBindings;
