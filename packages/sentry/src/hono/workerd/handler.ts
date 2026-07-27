import type {
  ExecutionContext,
  ExportedHandler,
} from "@cloudflare/workers-types";
import type { Hono } from "hono";
import type { SentryBindings } from "../bindings";
import type { SentryConfig } from "../../shared/config";
import { sentryErrorHandler } from "../error-handler";
import { withRequestClient } from "./with-request-client";

// Installs onError as a side effect; the two halves are useless apart.
export function withSentry<Bindings extends SentryBindings>(
  app: Hono<{ Bindings: Bindings }>,
  config: SentryConfig = {},
): ExportedHandler<Bindings> {
  app.onError(sentryErrorHandler());

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
