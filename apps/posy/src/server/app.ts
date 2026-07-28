import { sentryTunnel, type SentryConfig } from "@acme/sentry/hono";
import { Hono } from "hono";
import type { Dialect } from "kysely";
import { authRoutes } from "./auth";
import { debugRoutes, isDebugEnabled } from "./debug";
import type { AppBindings } from "./bindings";
import { gate } from "./gate";

// One policy for both halves: the tunnel scrubs client events, withSentry the
// server's. Auth is the only sensitive thing posy handles.
export const sentryConfig: SentryConfig = {
  masking: "light",
  // The deploy health check probes every deploy; CI already reports its failures.
  ignoreUserAgent: "acme-ci-health-probe",
};

// The dialect is resolved lazily per request so environments without a DB
// binding still serve assets and /health.
export function createApp(
  getDialect: (env: AppBindings) => Dialect,
): Hono<{ Bindings: AppBindings }> {
  const app = new Hono<{ Bindings: AppBindings }>();

  app.use(gate());
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
    }),
  );

  // Under run_worker_first the worker fronts every request; the assets binding
  // applies the configured SPA not_found_handling itself.
  app.all("*", (ctx) => ctx.env.ASSETS.fetch(ctx.req.raw));

  return app;
}
