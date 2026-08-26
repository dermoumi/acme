import type { Limiter } from "../../runtime/contract";

export interface TestBindings {
  RATE_LIMIT_TEST?: Limiter;
  RATE_LIMIT_OTHER?: Limiter;
}

// Both runtimes bind this, so tests never learn which one they run on.
export type CreateBindings = (
  overrides?: Partial<TestBindings>,
) => TestBindings;
