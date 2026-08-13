import { createRateLimiter } from "@acme/rate-limiter";
import { sentryTunnel, type SentryConfig } from "@acme/sentry/hono";
import { type Context, Hono } from "hono";
import { sql } from "kysely";
import { authRoutes } from "./auth";
import type { AppBindings, AppEnv } from "./bindings";
import { getDb } from "./db";
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

// A query, not a binding check: the url is only opened on first use.
async function databaseStatus(ctx: Context<AppEnv>): Promise<"down" | "ok"> {
  try {
    await sql`select 1`.execute(await getDb(ctx));

    return "ok";
  } catch {
    return "down";
  }
}

export interface AppOptions {
  /**
   * CIDR ranges whose `x-forwarded-for` may speak for the client behind them;
   * malformed ones throw at startup. Inert on Workers, load-bearing on node,
   * which is why it can look unused here.
   */
  trustedProxies?: readonly string[];
}

export function createApp(options: AppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const limiter = createRateLimiter<AppBindings>({
    trustedProxies: options.trustedProxies,
  });

  app.use(gate({ open: ["/health"], realm: "Posy Staging" }));

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
  app.get("/health", async (ctx) =>
    ctx.json({
      status: "ok",
      app: "posy",
      version: ctx.env.APP_VERSION ?? "dev",
      // The deploy check waits for this, so a stale version cannot pass it.
      revision: ctx.env.APP_REVISION ?? "dev",
      sentry: ctx.env.SENTRY_DSN ? "configured" : "off",
      // Limiting fails open, so a lost binding is silent without this.
      rateLimit: limiter.status(ctx.env),
      database: await databaseStatus(ctx),
    }),
  );

  // Under run_worker_first the worker fronts every request; the assets binding
  // applies the configured SPA not_found_handling itself.
  app.all("*", (ctx) => ctx.env.ASSETS.fetch(ctx.req.raw));

  return app;
}
