import {
  clientAddress,
  getBinding,
  getTrustedProxies,
  SELF_PROVISIONED,
} from "#runtime";
import type { Context, Hono, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { rateLimiter } from "hono-rate-limiter";
import { bound } from "./bindings";
import type { Limiter } from "./runtime/contract";
import {
  compileTrustedProxies,
  type TrustedProxiesConfig,
} from "./trusted-proxies";

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
  /**
   * Other methods on the same path stay uncapped.
   */
  method: Method;
  /**
   * A Hono route pattern, such as `/login` or `/api/*`.
   */
  path: string;
  /**
   * Names the budget to count against; one no budget declares throws.
   */
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
   *
   * A function is called with the environment, on node only. Defaults to
   * comma-separated `TRUSTED_PROXIES`, and empty trusts none.
   */
  trustedProxies?: TrustedProxiesConfig;
}

type Cap<Bindings extends object> = MiddlewareHandler<{ Bindings: Bindings }>;
type KeyOf = (ctx: Context) => string;

// The route caps and consume() share it, so both spend the same budget.
interface Counter<Bindings extends object> {
  cap: Cap<Bindings>;
  getLimiter: ReturnType<typeof getBinding>;
}

function buildCounter<Bindings extends object>(
  budget: Budget<Bindings>,
  keyOf: KeyOf,
): Counter<Bindings> {
  const { binding, limit, periodSeconds } = budget;
  const getLimiter = getBinding(binding, limit, periodSeconds);
  const cap = rateLimiter<{ Bindings: Bindings }>({
    binding: getLimiter,
    keyGenerator: keyOf,
    // Thrown, so the app's onError can answer a browser with a page instead.
    handler: () => {
      const body = { error: "rate_limited" };
      const headers = { "Retry-After": String(periodSeconds) };
      const res = Response.json(body, { status: 429, headers });
      throw new HTTPException(429, { res });
    },
  });

  return { cap, getLimiter };
}

// One counter per budget, not per route: on node each counts in its own store.
function buildCounters<Bindings extends object>(
  budgets: readonly Budget<Bindings>[],
  keyOf: KeyOf,
): Map<string, Counter<Bindings>> {
  const counters = new Map<string, Counter<Bindings>>();

  for (const budget of budgets) {
    if (counters.has(budget.binding)) {
      const message = `${budget.binding} is declared more than once`;
      throw new Error(message);
    }

    counters.set(budget.binding, buildCounter(budget, keyOf));
  }

  return counters;
}

interface Mount<Bindings extends object> {
  route: LimitedRoute<Bindings>;
  cap: Cap<Bindings>;
}

function planMounts<Bindings extends object>(
  routes: readonly LimitedRoute<Bindings>[],
  counters: Map<string, Counter<Bindings>>,
): Mount<Bindings>[] {
  return routes.map((route) => {
    const counter = counters.get(route.binding);
    if (!counter) {
      const message = `${route.method} ${route.path} names an undeclared budget: ${route.binding}`;
      throw new Error(message);
    }

    return { route, cap: counter.cap };
  });
}

export interface RateLimiter<Bindings extends object> {
  // Mount ahead of the app's own routes: behind them the route answers first
  // and the cap never runs.
  // oxlint-disable-next-line no-explicit-any
  mount(app: Hono<any>): void;
  // Per request: on workerd the bindings only exist once one is in.
  status(env: Bindings): LimiterStatus;
  consume(ctx: Context, binding: string): Promise<boolean>;
}

export function createRateLimiter<Bindings extends object>(
  config: RateLimiterConfig<Bindings>,
): RateLimiter<Bindings> {
  // Built before anything mounts, so a bad config cannot sit unnoticed.
  const trustedProxies = compileTrustedProxies(
    getTrustedProxies(config.trustedProxies),
  );
  // Unidentifiable callers share one budget.
  const keyOf: KeyOf = (ctx) => {
    return clientAddress(ctx, trustedProxies) ?? "unknown";
  };
  const counters = buildCounters(config.budgets, keyOf);
  const mounts = planMounts(config.routes, counters);

  return {
    mount(app) {
      for (const { route, cap } of mounts) {
        app.on(route.method, route.path, cap);
      }
    },

    status(env): LimiterStatus {
      if (counters.size === 0) return "off";
      if (SELF_PROVISIONED) return "on";

      const names = [...counters.keys()];
      const count = names.filter((name) => bound(env, name)).length;
      return count === counters.size ? "on" : count === 0 ? "off" : "partial";
    },

    async consume(ctx, binding) {
      const counter = counters.get(binding);
      if (!counter) {
        const message = `consumeRateLimit names an undeclared budget: ${binding}`;
        throw new Error(message);
      }

      const limiter = counter.getLimiter(ctx);
      const { success } = await limiter.limit({ key: keyOf(ctx) });
      return success;
    },
  };
}
