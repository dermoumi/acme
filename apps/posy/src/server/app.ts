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
   * Window reported in `Retry-After`, matching each `ratelimits` entry's
   * `period`. Unset mounts no limiting, and `/health` then reads `off`
   * whatever is bound.
   */
  rateLimitPeriodSeconds?: number;
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

function mountRateLimits(
  app: Hono<{ Bindings: AppBindings }>,
  periodSeconds: number,
  trustedProxies: TrustedProxies,
): void {
  // POST only: GET /session fires on every app load and must stay uncapped.
  app.on(
    "POST",
    "/session",
    rateLimit({ binding: "RATE_LIMIT_LOGIN", periodSeconds, trustedProxies }),
  );
  // The tunnel serves exactly one route at its mount root; a /sentry/* pattern
  // would also match /sentry and charge every request twice.
  app.on(
    "POST",
    "/sentry",
    rateLimit({ binding: "RATE_LIMIT_SENTRY", periodSeconds, trustedProxies }),
  );
}

export function createApp(
  options: AppOptions,
): Hono<{ Bindings: AppBindings }> {
  const { getDialect, rateLimitPeriodSeconds } = options;
  const app = new Hono<{ Bindings: AppBindings }>();

  // Compiled here even when nothing is mounted, so a typo cannot sit unnoticed
  // in the config of an app that has not wired its limiters up yet.
  const trustedProxies = compileTrustedProxies(options.trustedProxies ?? []);
  const limiting = rateLimitPeriodSeconds !== undefined;

  app.use(gate());
  if (limiting) {
    mountRateLimits(app, rateLimitPeriodSeconds, trustedProxies);
  }
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
      // Limiting fails open, so a lost binding is silent without this. Unmounted
      // reads "off" whatever is bound, since nothing is enforcing them.
      rateLimit: limiting ? limiterStatus(ctx.env) : "off",
    }),
  );

  // Under run_worker_first the worker fronts every request; the assets binding
  // applies the configured SPA not_found_handling itself.
  app.all("*", (ctx) => ctx.env.ASSETS.fetch(ctx.req.raw));

  return app;
}
