import { type Handler, serve } from "@acme/app/server";
import { withSentry } from "@acme/sentry/hono";
import { createApp, sentryConfig } from "./app";
import type { AppEnv } from "./bindings";

export default serve<AppEnv>((app) => {
  app.route("/", createApp());

  // withSentry's workerd arm declares ExportedHandler, whose fetch is optional
  // though it always sets one; its node arm declares SentryHandler, which is not.
  return withSentry(app, sentryConfig) as Handler;
});
