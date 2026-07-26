import { env } from "cloudflare:test";
import type { GateBindings } from "../gate";
import type { CreateBindings } from "./contract";

export const createBindings: CreateBindings = (overrides = {}) => ({
  ASSETS: env.ASSETS as GateBindings["ASSETS"],
  ...overrides,
});
