import { type Context, Hono } from "hono";
import { sql } from "kysely";
import { authRoutes } from "./auth";
import type { AppEnv } from "./bindings";
import { debugRoutes, isDebugEnabled } from "./debug";
import { gate } from "./gate";

// A query, not a binding check: the url is only opened on first use.
async function databaseStatus(ctx: Context<AppEnv>): Promise<"down" | "ok"> {
  try {
    const db = await ctx.var.getDb("DATABASE");

    await sql`select 1`.execute(db);

    return "ok";
  } catch {
    return "down";
  }
}

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use(gate({ open: ["/health"], realm: "Posy Staging" }));

  app.route("/session", authRoutes());
  // Mounted everywhere but answered only off production, so the tier decides at
  // request time rather than at build time.
  app.use("/debug/*", async (ctx, next) =>
    isDebugEnabled(ctx.env) ? next() : ctx.notFound(),
  );
  app.route("/debug", debugRoutes());
  // Whether a DSN is set, not whether Sentry is reachable: capture fails soft.
  app.get("/health", async (ctx) =>
    ctx.json({
      status: "ok",
      app: "posy",
      version: ctx.env.APP_VERSION ?? "dev",
      // The deploy check waits for this, so a stale version cannot pass it.
      revision: ctx.env.APP_REVISION ?? "dev",
      sentry: ctx.env.SENTRY_DSN ? "configured" : "off",
      // Limiting fails open, so a lost binding is silent without this.
      rateLimit: ctx.var.rateLimitStatus,
      database: await databaseStatus(ctx),
    }),
  );

  return app;
}
