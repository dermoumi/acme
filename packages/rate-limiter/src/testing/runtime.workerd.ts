import { env } from "cloudflare:test";
import type { Limiter } from "../contract";
import type { CreateBindings } from "./contract";

// Real miniflare bindings, so this run exercises the platform limiter itself.
export const createBindings: CreateBindings = (overrides = {}) => ({
  RATE_LIMIT_TEST: env.RATE_LIMIT_TEST as Limiter,
  RATE_LIMIT_OTHER: env.RATE_LIMIT_OTHER as Limiter,
  ...overrides,
});
