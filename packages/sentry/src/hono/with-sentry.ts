import type {
  ExecutionContext,
  Request as CfRequest,
} from "@cloudflare/workers-types";
import { type CloudflareOptions, wrapRequestHandler } from "@sentry/cloudflare";
import type { SentryBindings } from "./bindings";
import { sentryOptions } from "./options";

// Establishes the per-request client that sentryErrorHandler() captures onto.
export function withSentry(
  env: SentryBindings,
  request: CfRequest,
  ctx: ExecutionContext | undefined,
  handler: () => Response | Promise<Response>,
  overrides?: Partial<CloudflareOptions>,
): Response | Promise<Response> {
  const options = sentryOptions(env);
  if (!options || !ctx) return handler();

  return wrapRequestHandler(
    { options: { ...options, ...overrides }, request, context: ctx },
    handler,
  );
}
