import { withSentry } from "@acme/sentry/hono";
import { D1Dialect } from "kysely-d1";
import { createApp, rateLimitPolicies, sentryConfig } from "./app";

export const app = createApp({
  getDialect: (env) => {
    if (!env.DB) throw new Error("no D1 binding on this environment");
    return new D1Dialect({ database: env.DB });
  },
  rateLimits: rateLimitPolicies,
});

export default withSentry(app, sentryConfig);
