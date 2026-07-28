import type {
  ExecutionContext,
  ExportedHandler,
} from "@cloudflare/workers-types";
import type { Hono } from "hono";
import type { SentryBindings } from "../bindings";
import type { SentryConfig } from "../config";
import { sentryErrorHandler } from "../error-handler";
import { withRequestClient } from "./with-request-client";

/**
 * Wraps a Hono app into a Cloudflare Workers handler with Sentry attached.
 *
 * ```ts
 * export default withSentry(app, { masking: "light" });
 * ```
 *
 * Installs `app.onError` as a side effect. Both parts are required: Hono handles
 * route errors itself, so the request wrapper alone captures nothing thrown in a
 * route, and `onError` alone has no client to capture onto.
 *
 * Passes requests through unwrapped when `env.SENTRY_DSN` is unset.
 */
export function withSentry<Bindings extends SentryBindings>(
  app: Hono<{ Bindings: Bindings }>,
  config: SentryConfig = {},
): ExportedHandler<Bindings> {
  app.onError(sentryErrorHandler(config));

  return {
    fetch: (request, env, ctx: ExecutionContext) =>
      withRequestClient(
        env,
        request,
        ctx,
        () => app.fetch(request, env, ctx),
        config,
      ),
  };
}
