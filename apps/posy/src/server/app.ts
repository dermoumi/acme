import { Hono } from "hono";
import type { AppEnv } from "./bindings";
import { debugRoutes, isDebugEnabled } from "./debug";
import { gate } from "./gate";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use(gate({ open: ["/health"], realm: "Posy Staging" }));

  // Mounted everywhere but answered only off production, so the tier decides at
  // request time rather than at build time.
  app.use("/debug/*", async (ctx, next) =>
    isDebugEnabled(ctx.env) ? next() : ctx.notFound(),
  );
  app.route("/debug", debugRoutes());

  return app;
}
