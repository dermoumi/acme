import type {
  ExecutionContext,
  ExportedHandler,
} from "@cloudflare/workers-types";
import type { Hono } from "hono";
import type { SentryBindings } from "../bindings";
import type { SentryConfig } from "../config";
import { withRequestClient } from "./with-request-client";

/**
 * Wraps a Hono app into a Cloudflare Workers handler with Sentry attached.
 *
 * ```ts
 * export default withSentry(app, { masking: "light" });
 * ```
 *
 * Establishes the client `sentryErrorHandler` captures onto, which the kit
 * installs. Both parts are required: Hono answers route errors itself, so this
 * wrapper alone sees nothing thrown in a route, and the handler alone has no
 * client to capture onto.
 *
 * Passes requests through unwrapped when `env.SENTRY_DSN` is unset.
 */
export function withSentry<Env extends { Bindings: SentryBindings }>(
  app: Hono<Env>,
  config: SentryConfig = {},
): ExportedHandler<Env["Bindings"]> {
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
