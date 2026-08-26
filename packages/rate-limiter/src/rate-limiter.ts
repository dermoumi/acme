import { clientAddress, getBinding, SELF_PROVISIONED } from "#runtime";
import type { MiddlewareHandler } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { bound } from "./bindings";
import type { Limiter } from "./runtime/contract";
import { compileTrustedProxies } from "./trusted-proxies";

export type LimiterStatus = "on" | "partial" | "off";

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

/**
 * Mounts budgets and reports on them. Build with {@link createRateLimiter}.
 */
export interface RateLimiter<Bindings extends object> {
  /**
   * Middleware capping one budget, ready to mount.
   *
   * @param limit Counted per process on node, so replicas each get their own.
   *   On Workers the binding carries the budget and this only records intent.
   * @param periodSeconds Shapes `Retry-After` only, never the window
   *   measured.
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

/**
 * Caps how often one client may call the routes it is mounted on, keyed on IP.
 * Where nothing can count, the route keeps serving: this bounds cost, it is not
 * a security boundary.
 *
 * Build one per app, so a budget cannot outlive the app that owns it.
 */
export function createRateLimiter<Bindings extends object>(
  options: RateLimiterOptions = {},
): RateLimiter<Bindings> {
  // Compiled even when nothing is mounted, so a typo cannot sit unnoticed.
  const trusted = compileTrustedProxies(options.trustedProxies ?? []);
  const declared = new Set<string>();

  return {
    create(binding, limit, periodSeconds) {
      declared.add(binding);
      return rateLimiter<{ Bindings: Bindings }>({
        binding: getBinding(binding, limit, periodSeconds),
        // Unidentifiable callers share one budget.
        keyGenerator: (ctx) => clientAddress(ctx, trusted) ?? "unknown",
        handler: (ctx) => {
          ctx.res = ctx.json({ error: "rate_limited" }, 429, {
            "Retry-After": String(periodSeconds),
          });
        },
      });
    },

    status(env): LimiterStatus {
      if (declared.size === 0) return "off";
      if (SELF_PROVISIONED) return "on";

      const count = [...declared].filter((name) => bound(env, name)).length;
      return count === declared.size ? "on" : count === 0 ? "off" : "partial";
    },
  };
}
