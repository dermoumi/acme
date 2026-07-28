import { withSentry } from "@acme/sentry/hono";
import { serve } from "@hono/node-server";
import { createApp, rateLimitPolicies, sentryConfig } from "./app";
import { staticAssets } from "./assets.node";
import type { AppBindings } from "./bindings";
import { fileDialect } from "./db/sqlite.node";

// Workers builds env per request; node has one process, so the bindings and the
// sqlite handle are built once here and reused.
const env: AppBindings = {
  ASSETS: staticAssets(process.env.CLIENT_DIR ?? "./dist/client"),
  REQUIRE_AUTH: process.env.REQUIRE_AUTH,
  BASIC_AUTH: process.env.BASIC_AUTH,
  SENTRY_DSN: process.env.SENTRY_DSN,
  APP_NAME: process.env.APP_NAME,
  APP_ENV: process.env.APP_ENV,
  APP_VERSION: process.env.APP_VERSION,
  APP_REVISION: process.env.APP_REVISION,
};

const dialect = fileDialect(process.env.DATABASE_PATH ?? "./posy.db");
const handler = withSentry(
  createApp({
    getDialect: () => dialect,
    rateLimits: rateLimitPolicies,
    // Cloudflare sets cf-connecting-ip itself, so only node has to decide whose
    // forwarded header to believe. Empty trusts none, which is the safe default.
    trustedProxies: (process.env.TRUSTED_PROXIES ?? "")
      .split(",")
      .map((range) => range.trim())
      .filter(Boolean),
  }),
  sentryConfig,
);

serve({
  fetch: (request: Request) => handler.fetch(request, env),
  port: Number(process.env.PORT ?? 3000),
  hostname: "0.0.0.0",
});
