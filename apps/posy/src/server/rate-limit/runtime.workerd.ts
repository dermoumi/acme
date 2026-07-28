import type { ClientKey, CreateLimiter } from "./contract";

// Keyed on IP, never username: per-username buckets let anyone lock a user out.
export const clientKey: ClientKey = (ctx) =>
  ctx.req.header("cf-connecting-ip") ?? "unknown";

// Only the platform can count here, and it does so from wrangler.jsonc.
export const SELF_PROVISIONED: boolean = false;
export const createLimiter: CreateLimiter = () => undefined;
