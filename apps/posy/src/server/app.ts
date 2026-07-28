import { sentryTunnel, type SentryConfig } from "@acme/sentry/hono";
import { Hono } from "hono";
import type { Dialect } from "kysely";
import { authRoutes } from "./auth";
import { debugRoutes, isDebugEnabled } from "./debug";
import type { AppBindings } from "./bindings";
import { gate } from "./gate";
import {
  compileTrustedProxies,
  limiterStatus,
  rateLimit,
  type LimiterStore,
  type RateLimitPolicy,
  type TrustedProxies,
} from "./rate-limit";

// One policy for both halves: the tunnel scrubs client events, withSentry the
// server's. Auth is the only sensitive thing posy handles.
export const sentryConfig: SentryConfig = {
  masking: "light",
  // The deploy health check probes every deploy; CI already reports its failures.
  ignoreUserAgent: "acme-ci-health-probe",
};

export interface AppOptions {
  /** Resolved per request, so an environment with no DB still serves assets. */
  getDialect: (env: AppBindings) => Dialect;
  /**
   * Routes to cap, one entry each. Absent or empty mounts no limiting, and
   * `/health` then reads `off` whatever is bound.
   */
  rateLimits?: readonly RateLimitPolicy[];
  /**
   * Where a self-provisioning runtime counts, one store per policy so budgets
   * keep separate key spaces. Defaults to memory, which is per replica; return
   * a `RedisStore` sharing one client to count across them. Ignored on Workers,
   * where the platform binding does the counting.
   */
  rateLimitStore?: LimiterStore;
  /**
   * CIDR ranges whose `x-forwarded-for` may speak for the client behind it,
   * e.g. `["10.1.0.0/24"]`. Defaults to none, so no header is ever believed.
   * Malformed ranges throw here, at startup.
   *
   * **Inert on Workers, load-bearing on node**, which is why it can look unused:
   * Cloudflare sets `cf-connecting-ip` itself, so only node has to decide whose
   * forwarded header to trust. Not dead config.
   */
  trustedProxies?: readonly string[];
}

// Each policy names its own method, so a path stays uncapped for every method
// it does not list: GET /session fires on every app load.
function mountRateLimits(
  app: Hono<{ Bindings: AppBindings }>,
  policies: readonly RateLimitPolicy[],
  trustedProxies: TrustedProxies,
  store: LimiterStore | undefined,
): void {
  for (const policy of policies) {
    app.on(
      policy.method,
      policy.path,
      rateLimit(policy, trustedProxies, store?.(policy)),
    );
  }
}

export function createApp(
  options: AppOptions,
): Hono<{ Bindings: AppBindings }> {
  const { getDialect } = options;
  const rateLimits = options.rateLimits ?? [];
  const app = new Hono<{ Bindings: AppBindings }>();

  // Compiled here even when nothing is mounted, so a typo cannot sit unnoticed
  // in the config of an app that has not wired its limiters up yet.
  const trustedProxies = compileTrustedProxies(options.trustedProxies ?? []);

  app.use(gate());
  mountRateLimits(app, rateLimits, trustedProxies, options.rateLimitStore);
  app.route("/session", authRoutes(getDialect));
  // Inside the gate: staging's basic auth covers this like every other route.
  app.route("/sentry", sentryTunnel(sentryConfig));
  // Mounted everywhere but answered only off production, so the tier decides at
  // request time rather than at build time.
  app.use("/debug/*", async (ctx, next) =>
    isDebugEnabled(ctx.env) ? next() : ctx.notFound(),
  );
  app.route("/debug", debugRoutes());
  // Whether a DSN is set, not whether Sentry is reachable; capture is fail-soft.
  app.get("/health", (ctx) =>
    ctx.json({
      status: "ok",
      app: "posy",
      version: ctx.env.APP_VERSION ?? "dev",
      // The deploy check waits for this, so a stale version cannot pass it.
      revision: ctx.env.APP_REVISION ?? "dev",
      sentry: ctx.env.SENTRY_DSN ? "configured" : "off",
      // Limiting fails open, so a lost binding is silent without this.
      rateLimit: limiterStatus(ctx.env, rateLimits),
    }),
  );

  // Under run_worker_first the worker fronts every request; the assets binding
  // applies the configured SPA not_found_handling itself.
  app.all("*", (ctx) => ctx.env.ASSETS.fetch(ctx.req.raw));

  return app;
}
