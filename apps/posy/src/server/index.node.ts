import { withSentry } from "@acme/sentry/hono";
import { serve } from "@hono/node-server";
import { createApp, sentryConfig } from "./app";
import { staticAssets } from "./assets.node";
import type { AppBindings } from "./bindings";

// Workers builds env per request; node has one process, so the bindings are
// built once here and reused. @acme/db opens DATABASE_URL on first use.
const env: AppBindings = {
  ASSETS: staticAssets(process.env.CLIENT_DIR ?? "./dist/client"),
  DATABASE_URL: process.env.DATABASE_URL,
  REQUIRE_AUTH: process.env.REQUIRE_AUTH,
  BASIC_AUTH: process.env.BASIC_AUTH,
  SENTRY_DSN: process.env.SENTRY_DSN,
  APP_NAME: process.env.APP_NAME,
  APP_ENV: process.env.APP_ENV,
  APP_VERSION: process.env.APP_VERSION,
  APP_REVISION: process.env.APP_REVISION,
};

const handler = withSentry(
  createApp({
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
