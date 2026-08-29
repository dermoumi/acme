import { createRateLimiter } from "@acme/rate-limiter";
import { Hono } from "hono";
import { authRoutes } from "./auth";
import type { AppBindings, AppEnv } from "./bindings";
import { debugRoutes, isDebugEnabled } from "./debug";
import { gate } from "./gate";

// Mirror wrangler.jsonc, which no runtime reads back. Exported so a test reads
// the budget off the source instead of copying it.
export const RATE_LOGIN_LIMIT = 10;
export const RATE_LOGIN_PERIOD = 60;
export const RATE_TUNNEL_LIMIT = 60;
export const RATE_TUNNEL_PERIOD = 60;

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  // No trusted proxies: empty trusts none, and whose forwarded header to
  // believe becomes the rate-limit kit's to decide.
  const limiter = createRateLimiter<AppBindings>({});

  app.use(gate({ open: ["/health"], realm: "Posy Staging" }));

  // POST only keeps the per-load GET uncapped; /sentry exact, /* would double.
  // The tunnel itself is the sentry kit's, mounted behind this and the gate.
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
  // Mounted everywhere but answered only off production, so the tier decides at
  // request time rather than at build time.
  app.use("/debug/*", async (ctx, next) =>
    isDebugEnabled(ctx.env) ? next() : ctx.notFound(),
  );
  app.route("/debug", debugRoutes());

  return app;
}
