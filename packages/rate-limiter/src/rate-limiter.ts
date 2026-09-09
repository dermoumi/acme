import { clientAddress, getBinding, SELF_PROVISIONED } from "#runtime";
import type { Hono, MiddlewareHandler } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { bound } from "./bindings";
import type { Limiter } from "./runtime/contract";
import { compileTrustedProxies, type TrustedProxies } from "./trusted-proxies";

/**
 * Whether every declared budget can be enforced. `partial` means only some.
 */
export type LimiterStatus = "on" | "partial" | "off";

// Binding names holding a Limiter, so a typo in a budget will not compile.
export type LimiterBinding<Bindings> = {
  [Key in keyof Bindings]-?: Limiter extends NonNullable<Bindings[Key]>
    ? Key
    : never;
}[keyof Bindings] &
  string;

/**
 * The methods a cap can be declared on.
 */
export type Method = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

/**
 * One budget, named after the binding carrying it in `wrangler.jsonc`.
 */
export interface Budget<Bindings extends object> {
  binding: LimiterBinding<Bindings>;
  /**
   * Counted per process on node, so replicas each get their own. On Workers
   * the binding carries the budget and this only records intent.
   */
  limit: number;
  /**
   * Shapes `Retry-After` only, never the window measured.
   */
  periodSeconds: number;
}

/**
 * One route a budget caps.
 */
export interface LimitedRoute<Bindings extends object> {
  method: Method;
  path: string;
  binding: LimiterBinding<Bindings>;
}

/**
 * What the rate limiter kit takes.
 */
export interface RateLimiterConfig<Bindings extends object> {
  /**
   * What to count with. Each needs a route, or construction throws.
   */
  budgets: readonly Budget<Bindings>[];
  /**
   * What each budget caps, mounted ahead of the app's own routes.
   */
  routes: readonly LimitedRoute<Bindings>[];
  /**
   * CIDR ranges whose `x-forwarded-for` may speak for the client behind them;
   * malformed ones throw. Inert on Workers, which set `cf-connecting-ip`
   * themselves, and load-bearing on node, so it can look unused without being
   * dead config.
   */
  trustedProxies?: readonly string[];
}

type Cap<Bindings extends object> = MiddlewareHandler<{ Bindings: Bindings }>;

function buildCap<Bindings extends object>(
  budget: Budget<Bindings>,
  trustedProxies: TrustedProxies,
): Cap<Bindings> {
  const { binding, limit, periodSeconds } = budget;

  return rateLimiter<{ Bindings: Bindings }>({
    binding: getBinding(binding, limit, periodSeconds),
    // Unidentifiable callers share one budget.
    keyGenerator: (ctx) => clientAddress(ctx, trustedProxies) ?? "unknown",
    handler: (ctx) => {
      ctx.res = ctx.json({ error: "rate_limited" }, 429, {
        "Retry-After": String(periodSeconds),
      });
    },
  });
}

// One cap per budget, not per route: on node each counts in its own store.
function buildCaps<Bindings extends object>(
  budgets: readonly Budget<Bindings>[],
  trustedProxies: TrustedProxies,
): Map<string, Cap<Bindings>> {
  const caps = new Map<string, Cap<Bindings>>();

  for (const budget of budgets) {
    if (caps.has(budget.binding)) {
      const message = `${budget.binding} is declared more than once`;
      throw new Error(message);
    }

    caps.set(budget.binding, buildCap(budget, trustedProxies));
  }

  return caps;
}

interface Mount<Bindings extends object> {
  route: LimitedRoute<Bindings>;
  cap: Cap<Bindings>;
}

function planMounts<Bindings extends object>(
  routes: readonly LimitedRoute<Bindings>[],
  caps: Map<string, Cap<Bindings>>,
): Mount<Bindings>[] {
  const mounts = routes.map((route) => {
    const cap = caps.get(route.binding);
    if (!cap) {
      const message = `${route.method} ${route.path} names an undeclared budget: ${route.binding}`;
      throw new Error(message);
    }

    return { route, cap };
  });

  const mountedBindings = new Set<string>(
    mounts.map((mount) => mount.route.binding),
  );
  const idleBinding = [...caps.keys()].find(
    (binding) => !mountedBindings.has(binding),
  );
  if (idleBinding !== undefined) {
    const message = `${idleBinding} is declared but caps no route`;
    throw new Error(message);
  }

  return mounts;
}

export interface RateLimiter<Bindings extends object> {
  // Mount ahead of the app's own routes: behind them the route answers first
  // and the cap never runs.
  // oxlint-disable-next-line no-explicit-any
  mount(app: Hono<any>): void;
  // Per request: on workerd the bindings only exist once one is in.
  status(env: Bindings): LimiterStatus;
}

export function createRateLimiter<Bindings extends object>(
  config: RateLimiterConfig<Bindings>,
): RateLimiter<Bindings> {
  // Built before anything mounts, so a bad config cannot sit unnoticed.
  const trustedProxies = compileTrustedProxies(config.trustedProxies ?? []);
  const caps = buildCaps(config.budgets, trustedProxies);
  const mounts = planMounts(config.routes, caps);

  return {
    mount(app) {
      for (const { route, cap } of mounts) {
        app.on(route.method, route.path, cap);
      }
    },

    status(env): LimiterStatus {
      if (caps.size === 0) return "off";
      if (SELF_PROVISIONED) return "on";

      const count = [...caps.keys()].filter((name) => bound(env, name)).length;
      return count === caps.size ? "on" : count === 0 ? "off" : "partial";
    },
  };
}
