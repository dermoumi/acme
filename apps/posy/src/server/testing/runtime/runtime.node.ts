import type { CreateBindings } from "./contract";

// No limiters: node builds its own from the policies createApp was given, so
// binding one here would override the thing under test.
export const createBindings: CreateBindings = (overrides = {}) => ({
  ...overrides,
});
