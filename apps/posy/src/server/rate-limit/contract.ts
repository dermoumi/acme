import type { Context } from "hono";

/**
 * Consumes one unit of budget for `key` and reports whether the caller is still
 * within it.
 *
 * Structurally identical to Cloudflare's `RateLimit` binding, so on workerd the
 * platform supplies this directly and no adapter is needed. Node entrypoints
 * bind an equivalent object; see `createMemoryLimiter` in `runtime.node.ts`.
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
 * How completely the limiters are bound, as reported on `/health`. `off` means
 * none and is a legitimate local setup; `misconfigured` means some but not all,
 * which never is. See {@link limiterStatus}.
 */
export type LimiterStatus = "configured" | "misconfigured" | "off";

/**
 * Which proxies are allowed to speak for the client they forwarded.
 *
 * An empty list, the default, means no `x-forwarded-for` header is ever believed
 * and clients are keyed on the address we actually see.
 */
export interface TrustOptions {
  trustedProxies: readonly string[];
}

/**
 * Attributes a request to a client. Implemented once per runtime: workerd reads
 * `cf-connecting-ip`, node has to reason about `x-forwarded-for` instead.
 */
export type ClientKey = (
  ctx: Context<{ Bindings: RateLimitBindings }>,
  trust: TrustOptions,
) => string;

/** Configuration for one protected route. */
export interface RateLimitOptions {
  /** Which binding holds this route's budget. */
  binding: keyof RateLimitBindings;
  /**
   * Seconds to report in `Retry-After`. Must match the `period` configured for
   * this binding in `wrangler.jsonc`: Cloudflare's outcome carries no reset
   * time, so a configured period is the only value we can report.
   */
  periodSeconds: number;
  /**
   * CIDR ranges whose `x-forwarded-for` header is trusted, e.g.
   * `["10.1.0.0/24"]`. Defaults to none.
   *
   * Prefer the narrowest range that covers your proxies. Trusting a whole
   * private space such as `172.16.0.0/12` trusts every container on the default
   * Docker bridge, any of which could then forge a client address.
   */
  trustedProxies?: readonly string[];
}

// Must match the `simple.limit` values in wrangler.jsonc; the node arm and the
// tests have no way to read that file.
export const LOGIN_LIMIT = 10;
export const SENTRY_LIMIT = 60;
export const PERIOD_SECONDS = 60;
