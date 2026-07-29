import type { CreateBindings } from "./contract";

// No limiters: node builds its own, so binding one would hide what is tested.
export const createBindings: CreateBindings = (overrides = {}) => ({
  ...overrides,
});
