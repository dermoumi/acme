import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  setAsyncLocalStorageAsyncContextStrategy,
  wrapRequestHandler,
} from "@sentry/cloudflare";
import { buildSentryOptions } from "../../hono/options";
import type { ClientCloser, HandlerWrapper } from "./contract";

// Only Sentry's own handler installs this; without it every request shares one isolation scope.
setAsyncLocalStorageAsyncContextStrategy();

// Per request, not per process: the DSN is a binding, and bindings do not exist
// at the module scope a kit is built in.
export const wrapHandler: HandlerWrapper = (handler, config) => {
  return {
    fetch: (request, env, ctx) => {
      const options = buildSentryOptions(env, config);
      // A host hands the entry whatever its own runtime has, and on workers
      // that is the execution context this needs to send from.
      const context = ctx as ExecutionContext | undefined;
      if (!options || !context) return handler.fetch(request, env, ctx);

      return wrapRequestHandler({ options, request, context }, () =>
        handler.fetch(request, env, ctx),
      );
    },
  };
};

// A worker has no process to leave, and nothing outside a request to flush.
export const closeClient: ClientCloser = () => {
  return Promise.resolve();
};
