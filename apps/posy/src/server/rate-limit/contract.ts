import type { Context } from "hono";
import type { Store } from "hono-rate-limiter";
import type { TrustedProxies } from "./trusted-proxies";

/**
 * Consumes one unit of budget for `key` and reports whether the caller is still
 * within it.
 *
 * Structurally identical to Cloudflare's `RateLimit` binding, so on workerd the
 * platform supplies this directly and no adapter is needed. Node entrypoints
 * build one from the policy itself; see `createLimiter` in `runtime.node.ts`.
 */
export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * One binding per protected budget, both optional.
 *
 * A missing binding disables limiting for that route instead of failing the
 * request, matching the `DB`-optional and Sentry-fail-soft conventions.
 */
export interface RateLimitBindings {
  RATE_LIMIT_LOGIN?: Limiter;
  RATE_LIMIT_SENTRY?: Limiter;
}

/**
 * Whether limiting is in force, as reported on `/health`. `off` covers both no
 * policies and none in force; `partial` means some but not all. See
 * {@link limiterStatus}.
 */
export type LimiterStatus = "on" | "partial" | "off";

/** Builds a policy's limiter where the runtime can, undefined where only a
 * platform binding supplies one. `store` counts somewhere shared instead. */
export type CreateLimiter = (
  policy: RateLimitPolicy,
  store?: Store,
) => Limiter | undefined;

/** Supplies a store per policy, so each budget can carry its own key space. */
export type LimiterStore = (policy: RateLimitPolicy) => Store;

/**
 * Which proxies are allowed to speak for the client they forwarded.
 *
 * An empty list, the default, means no `x-forwarded-for` header is ever believed
 * and clients are keyed on the address we actually see.
 */
export interface TrustOptions {
  trustedProxies: TrustedProxies;
}

/**
 * Attributes a request to a client. Implemented once per runtime: workerd reads
 * `cf-connecting-ip`, node has to reason about `x-forwarded-for` instead.
 */
export type ClientKey = (
  ctx: Context<{ Bindings: RateLimitBindings }>,
  trust: TrustOptions,
) => string;

/**
 * One protected route. An ordered list of these is the whole policy, so adding
 * a limited endpoint is a new entry rather than an edit to the app factory.
 */
export interface RateLimitPolicy {
  /** HTTP method to cap. Only this method is limited, never the whole path. */
  method: string;
  /** Path to cap, matched exactly as `app.on` would. */
  path: string;
  /** Which binding holds this route's budget. */
  binding: keyof RateLimitBindings;
  /**
   * Requests allowed per window, mirroring `simple.limit` in `wrangler.jsonc`.
   * **Never read at runtime**: the bound limiter enforces its own budget, so
   * this records the intent and a wrong value misleads readers in silence.
   */
  limit: number;
  /**
   * Seconds reported in `Retry-After`, mirroring `simple.period`. Cloudflare's
   * outcome carries no reset time, so a declared period is all we can report.
   * Shapes that header only, never the window a request is measured against.
   */
  periodSeconds: number;
}
