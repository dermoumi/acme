import type {
  ExecutionContext,
  Request as CfRequest,
} from "@cloudflare/workers-types";
import {
  setAsyncLocalStorageAsyncContextStrategy,
  wrapRequestHandler,
} from "@sentry/cloudflare";
import type { SentryBindings } from "../bindings";
import type { SentryConfig } from "../config";
import { sentryOptions } from "../options";

// Only Sentry's own handler installs this; without it every request shares one isolation scope.
setAsyncLocalStorageAsyncContextStrategy();

// Establishes the per-request client that sentryErrorHandler() captures onto.
export function withRequestClient(
  env: SentryBindings,
  request: CfRequest,
  ctx: ExecutionContext | undefined,
  handler: () => Response | Promise<Response>,
  config: SentryConfig = {},
): Response | Promise<Response> {
  const options = sentryOptions(env, config);
  if (!options || !ctx) return handler();

  return wrapRequestHandler(
    { options: { ...options, ...config.options }, request, context: ctx },
    handler,
  );
}
