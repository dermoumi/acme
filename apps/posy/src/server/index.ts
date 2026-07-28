import { withSentry } from "@acme/sentry/hono";
import { D1Dialect } from "kysely-d1";
import { createApp, sentryConfig } from "./app";

export const app = createApp({
  getDialect: (env) => {
    if (!env.DB) throw new Error("no D1 binding on this environment");
    return new D1Dialect({ database: env.DB });
  },
  // limit and periodSeconds mirror wrangler.jsonc, which no runtime reads back.
  // POST only keeps the per-load GET uncapped; /sentry exact, /* double-charges.
  rateLimits: [
    {
      method: "POST",
      path: "/session",
      binding: "RATE_LIMIT_LOGIN",
      limit: 10,
      periodSeconds: 60,
    },
    {
      method: "POST",
      path: "/sentry",
      binding: "RATE_LIMIT_SENTRY",
      limit: 60,
      periodSeconds: 60,
    },
  ],
});

export default withSentry(app, sentryConfig);
