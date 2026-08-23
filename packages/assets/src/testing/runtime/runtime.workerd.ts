import { env } from "cloudflare:test";
import type { CreateBindings } from "./contract";

export const createBindings: CreateBindings = () => {
  return { ASSETS: env.ASSETS };
};
