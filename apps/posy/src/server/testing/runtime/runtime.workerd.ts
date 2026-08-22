import type { AssetsFetcher } from "@acme/assets";
import type { Limiter } from "@acme/rate-limiter";
import { env } from "cloudflare:test";
import type { CreateBindings } from "./contract";

// Real miniflare bindings, so this run exercises the platform limiter itself.
export const createBindings: CreateBindings = (overrides = {}) => ({
  ASSETS: env.ASSETS as AssetsFetcher,
  RATE_LIMIT_LOGIN: env.RATE_LIMIT_LOGIN as Limiter,
  RATE_LIMIT_SENTRY: env.RATE_LIMIT_SENTRY as Limiter,
  ...overrides,
});
