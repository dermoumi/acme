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

/** Methods a policy may cap. Hono uppercases, but the union keeps it uniform. */
export type RateLimitMethod =
  | "DELETE"
  | "GET"
  | "HEAD"
  | "OPTIONS"
  | "PATCH"
  | "POST"
  | "PUT";

/**
 * One protected route. An ordered list of these is the whole policy, so adding
 * a limited endpoint is a new entry rather than an edit to the app factory.
 */
export interface RateLimitPolicy {
  /**
   * Method to cap; only this one is limited, never the whole path. A union
   * because a typo would otherwise mount a route nothing ever matches, and
   * silently not limiting looks exactly like working.
   */
  method: RateLimitMethod;
  /** Path to cap, matched exactly as `app.on` would. */
  path: string;
  /** Which binding holds this route's budget. */
  binding: keyof RateLimitBindings;
  /**
   * Requests allowed per window, mirroring `simple.limit` in `wrangler.jsonc`.
   *
   * **Enforced where the runtime self-provisions**, which is node: this is the
   * budget. On Workers the platform binding carries its own and this only
   * records intent, so the two disagreeing is silent in that direction.
   */
  limit: number;
  /**
   * Seconds reported in `Retry-After`, mirroring `simple.period`. Cloudflare's
   * outcome carries no reset time, so a declared period is all we can report.
   * Shapes that header only, never the window a request is measured against.
   */
  periodSeconds: number;
}
