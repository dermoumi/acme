import {
  type Options,
  type RequestEventData,
  winterCGRequestToRequestData,
} from "@sentry/core";
import { init, withIsolationScope } from "@sentry/node";
import type { Hono } from "hono";
import type { SentryBindings } from "../bindings";
import type { SentryConfig, SentryHandler } from "../../shared/config";
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

// Built at startup: initialising inside a request binds the client to that request's scope.
export function withSentry<Bindings extends SentryBindings>(
  app: Hono<{ Bindings: Bindings }>,
  config: SentryConfig = {},
): SentryHandler<Bindings> {
  app.onError(sentryErrorHandler());

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
