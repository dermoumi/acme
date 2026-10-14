import type { ExecutionContext } from "@cloudflare/workers-types";
import { setAsyncLocalStorageAsyncContextStrategy } from "@sentry/cloudflare";
import { wrapRequestHandler } from "@sentry/cloudflare/request";
import type { Options } from "@sentry/core";
import { buildSentryOptions } from "../server/options";
import type { ClientCloser, HandlerWrapper } from "./contract";

// Only Sentry's own handler installs this; without it every request shares
// one isolation scope.
setAsyncLocalStorageAsyncContextStrategy();

// Built on the first request: the DSN is a binding, absent at module scope.
export const wrapHandler: HandlerWrapper = (handler, config) => {
  // null: not built yet; undefined: built, but there is no DSN.
  let options: Options | undefined | null = null;

  return {
    fetch: (request, env, ctx) => {
      if (options === null) {
        options = buildSentryOptions(env, config);
      }

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
