import {
  type Options,
  type RequestEventData,
  winterCGRequestToRequestData,
} from "@sentry/core";
import { init, withIsolationScope } from "@sentry/node";
import { buildSentryOptions } from "../../hono/options";
import { closeSentry } from "../../hono/node/close";
import type { ClientCloser, HandlerWrapper } from "./contract";

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

// Once per process, from process.env: node has one client, and initialising it
// inside a request would bind it to that request's scope.
export const wrapHandler: HandlerWrapper = (handler, config) => {
  const options = buildSentryOptions(process.env, config);
  if (!options) return handler;

  init(options);
  const withBody = wantsBody(options);

  return {
    fetch: async (request, env, ctx) =>
      withIsolationScope(async (scope) => {
        scope.setSDKProcessingMetadata({
          normalizedRequest: await describe(request, withBody),
        });

        return handler.fetch(request, env, ctx);
      }),
  };
};

export const closeClient: ClientCloser = () => {
  return closeSentry();
};
