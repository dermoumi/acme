import type { ClientKey } from "./contract";

// Keyed on IP, never username: per-username buckets let anyone lock a user out.
export const clientKey: ClientKey = (ctx) =>
  ctx.req.header("cf-connecting-ip") ?? "unknown";
