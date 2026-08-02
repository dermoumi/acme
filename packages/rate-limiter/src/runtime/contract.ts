import type { Context, Env } from "hono";
import type { TrustedProxies } from "../trusted-proxies";

/** Structurally identical to Cloudflare's `RateLimit`, which supplies it on workerd. */
export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

// Owns a runtime's answer to nothing being bound. Curried because a
// self-provisioned counter is built once per mount, not once per request.
export type GetBinding = (
  binding: string,
  limit: number,
  periodSeconds: number,
) => <BoundEnv extends Env>(ctx: Context<BoundEnv>) => Limiter;

// workerd reads cf-connecting-ip; node has to reason about x-forwarded-for.
// Undefined where the caller cannot be identified at all.
export type ClientAddress = <BoundEnv extends Env>(
  ctx: Context<BoundEnv>,
  trustedProxies: TrustedProxies,
) => string | undefined;
