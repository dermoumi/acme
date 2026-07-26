import { Hono } from "hono";
import type { Dialect } from "kysely";
import { authRoutes } from "./auth";
import type { AppBindings } from "./bindings";
import { gate } from "./gate";

// The dialect is resolved lazily per request so environments without a DB
// binding still serve assets and /health.
export function createApp(
  getDialect: (env: AppBindings) => Dialect,
): Hono<{ Bindings: AppBindings }> {
  const app = new Hono<{ Bindings: AppBindings }>();

  app.use(gate());
  app.route("/session", authRoutes(getDialect));
  app.get("/health", (ctx) => ctx.json({ status: "ok", app: "posy" }));

  // Under run_worker_first the worker fronts every request; the assets binding
  // applies the configured SPA not_found_handling itself.
  app.all("*", (ctx) => ctx.env.ASSETS.fetch(ctx.req.raw));

  return app;
}
