import { createRateLimiter } from "@acme/rate-limiter";
import { sentryTunnel, type SentryConfig } from "@acme/sentry/hono";
import { createDbSource, type DbSourceOptions } from "@acme/db";
import { dbMiddleware } from "@acme/db/hono";
import { Hono } from "hono";
import { authRoutes } from "./auth";
import type { AppEnv, AppBindings } from "./bindings";
import type { Database } from "./db";
import { debugRoutes, isDebugEnabled } from "./debug";
import { gate } from "./gate";

// One policy for both halves: the tunnel scrubs client events, withSentry the
// server's. Auth is the only sensitive thing posy handles.
export const sentryConfig: SentryConfig = {
  masking: "light",
  // The deploy health check probes every deploy; CI already reports its failures.
  ignoreUserAgent: "acme-ci-health-probe",
};

// Mirror wrangler.jsonc, which no runtime reads back. Exported so a test reads
// the budget off the source instead of copying it.
export const RATE_LOGIN_LIMIT = 10;
export const RATE_LOGIN_PERIOD = 60;
export const RATE_TUNNEL_LIMIT = 60;
export const RATE_TUNNEL_PERIOD = 60;

export interface AppOptions {
  /**
   * How to reach the database. Omit it on Workers, where the D1 binding is
   * found on `env`; node passes a url, and tests pass a ready-made dialect.
   */
  database?: DbSourceOptions;
  /**
   * CIDR ranges whose `x-forwarded-for` may speak for the client behind them;
   * malformed ones throw at startup. Inert on Workers, load-bearing on node,
   * which is why it can look unused here.
   */
  trustedProxies?: readonly string[];
}

export function createApp(options: AppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const db = createDbSource<Database>(options.database);
  const limiter = createRateLimiter<AppBindings>({
    trustedProxies: options.trustedProxies,
  });

  app.use(gate());
  app.use(dbMiddleware(db));

  // POST only keeps the per-load GET uncapped; /sentry exact, /* double-charges.
  app.on(
    "POST",
    "/session",
    limiter.create("RATE_LIMIT_LOGIN", RATE_LOGIN_LIMIT, RATE_LOGIN_PERIOD),
  );
  app.on(
    "POST",
    "/sentry",
    limiter.create("RATE_LIMIT_SENTRY", RATE_TUNNEL_LIMIT, RATE_TUNNEL_PERIOD),
  );
  app.route("/session", authRoutes());
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
      rateLimit: limiter.status(ctx.env),
    }),
  );

  // Under run_worker_first the worker fronts every request; the assets binding
  // applies the configured SPA not_found_handling itself.
  app.all("*", (ctx) => ctx.env.ASSETS.fetch(ctx.req.raw));

  return app;
}
