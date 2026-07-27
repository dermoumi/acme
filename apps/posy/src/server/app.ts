import { sentryTunnel, type SentryConfig } from "@acme/sentry/hono";
import { Hono } from "hono";
import type { Dialect } from "kysely";
import { authRoutes } from "./auth";
import type { AppBindings } from "./bindings";
import { gate } from "./gate";

// One policy for both halves: the tunnel scrubs client events, withSentry the
// server's. Auth is the only sensitive thing posy handles.
export const sentryConfig: SentryConfig = { masking: "light" };

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
  // Whether a DSN is set, not whether Sentry is reachable; capture is fail-soft.
  app.get("/health", (ctx) =>
    ctx.json({
      status: "ok",
      app: "posy",
      sentry: ctx.env.SENTRY_DSN ? "configured" : "off",
    }),
  );

  // Under run_worker_first the worker fronts every request; the assets binding
  // applies the configured SPA not_found_handling itself.
  app.all("*", (ctx) => ctx.env.ASSETS.fetch(ctx.req.raw));

  return app;
}
