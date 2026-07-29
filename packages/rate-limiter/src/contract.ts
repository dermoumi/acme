import type { Context, Env, MiddlewareHandler } from "hono";
import type { TrustedProxies } from "./trusted-proxies";

/** Structurally identical to Cloudflare's `RateLimit`, which supplies it on workerd. */
export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type LimiterStatus = "on" | "partial" | "off";

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

// Binding names holding a Limiter, so a typo in create() will not compile.
export type LimiterBinding<Bindings> = {
  [Key in keyof Bindings]-?: Limiter extends NonNullable<Bindings[Key]>
    ? Key
    : never;
}[keyof Bindings] &
  string;

export interface RateLimiterOptions {
  /**
   * CIDR ranges whose `x-forwarded-for` may speak for the client behind them;
   * malformed ones throw. Inert on Workers, which set `cf-connecting-ip`
   * themselves, and load-bearing on node, so it can look unused without being
   * dead config.
   */
  trustedProxies?: readonly string[];
}

/** Mounts budgets and reports on them. Build with {@link createRateLimiter}. */
export interface RateLimiter<Bindings extends object> {
  /**
   * Middleware capping one budget, ready to mount.
   *
   * @param limit - The budget on node, counted per process, so replicas each
   * get their own. On Workers the binding carries its own and this only
   * records intent.
   * @param periodSeconds - Shapes `Retry-After` only, never the window measured.
   */
  create(
    binding: LimiterBinding<Bindings>,
    limit: number,
    periodSeconds: number,
  ): MiddlewareHandler<{ Bindings: Bindings }>;
  /**
   * Status across every binding `create` was asked for. Call it inside the
   * handler: at module scope it would run before the mounts it reports on.
   */
  status(env: Bindings): LimiterStatus;
}
