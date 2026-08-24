import type {
  ExecutionContext,
  ExportedHandler,
  Request as CfRequest,
} from "@cloudflare/workers-types";
import {
  setAsyncLocalStorageAsyncContextStrategy,
  wrapRequestHandler,
} from "@sentry/cloudflare";
import type { Env, Hono } from "hono";
import type { SentryConfig } from "../config";
import { sentryOptions } from "../options";

// Only Sentry's own handler installs this; without it every request shares one isolation scope.
setAsyncLocalStorageAsyncContextStrategy();

// Establishes the per-request client that sentryErrorHandler() captures onto.
function withRequestClient(
  env: unknown,
  request: CfRequest,
  ctx: ExecutionContext | undefined,
  handler: () => Response | Promise<Response>,
  config: SentryConfig,
): Response | Promise<Response> {
  const options = sentryOptions(env, config);
  if (!options || !ctx) return handler();

  return wrapRequestHandler(
    { options: { ...options, ...config.options }, request, context: ctx },
    handler,
  );
}

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
 * Passes requests through unwrapped when no DSN is configured.
 */
export function withSentry<AppEnv extends Env>(
  app: Hono<AppEnv>,
  config: SentryConfig = {},
): ExportedHandler<AppEnv["Bindings"]> {
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
