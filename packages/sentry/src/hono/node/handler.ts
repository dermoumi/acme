import {
  type Options,
  type RequestEventData,
  winterCGRequestToRequestData,
} from "@sentry/core";
import { init, withIsolationScope } from "@sentry/node";
import type { Hono } from "hono";
import type { SentryBindings } from "../bindings";
import type { SentryConfig, SentryHandler } from "../config";
import { sentryErrorHandler } from "../error-handler";
import { sentryOptions } from "../options";

function wantsBody(options: Options): boolean {
  return (options.dataCollection?.httpBodies ?? []).includes("incomingRequest");
}

// Sentry only reads request data off node:http, which app.fetch bypasses.
async function describe(
  request: Request,
  withBody: boolean,
): Promise<RequestEventData> {
  const data = winterCGRequestToRequestData(request);
  if (!withBody) return data;
  try {
    const body = await request.clone().text();
    return body ? { ...data, data: body } : data;
  } catch {
    return data;
  }
}

/**
 * Wraps a Hono app into a fetch handler with Sentry attached, for node servers.
 *
 * ```ts
 * serve({ fetch: (request) => withSentry(app).fetch(request, env), port: 3000 });
 * ```
 *
 * Reads settings from `process.env` at startup: node has one client per process,
 * and initialising inside a request would bind it to that request's scope.
 * Installs `app.onError` as a side effect, as the Workers entry does.
 *
 * Passes requests through unwrapped when `SENTRY_DSN` is unset.
 */
export function withSentry<Env extends { Bindings: SentryBindings }>(
  app: Hono<Env>,
  config: SentryConfig = {},
): SentryHandler<Env["Bindings"]> {
  app.onError(sentryErrorHandler(config));

  const settings: SentryBindings = process.env;
  const options = sentryOptions(settings, config);
  if (!options) return { fetch: (request, env) => app.fetch(request, env) };

  init({ ...options, ...config.options });
  const withBody = wantsBody(options);

  return {
    fetch: async (request, env) =>
      withIsolationScope(async (scope) => {
        scope.setSDKProcessingMetadata({
          normalizedRequest: await describe(request, withBody),
        });
        return app.fetch(request, env);
      }),
  };
}
