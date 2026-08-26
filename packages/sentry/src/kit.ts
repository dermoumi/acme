import type { Kit } from "@acme/app";
import type { SentryConfig } from "./server/config";
import { createErrorHandler } from "./server/error-handler";
import { createTunnel } from "./server/tunnel";
import { closeClient, wrapHandler } from "#sentry";

// Must match initSentry's own default, which is where the browser posts.
const TUNNEL_PATH = "/sentry";

/**
 * The Sentry kit: error reporting for the server and the browser both.
 *
 * Declare it before any kit mounting a catch-all, or the tunnel falls through
 * to that instead. A sub-app setting its own `onError` is not covered.
 */
export function sentryKit(config: SentryConfig = {}): Kit {
  return {
    name: "@acme/sentry",
    config,
    vite: "@acme/sentry/vite",
    init: () => ({
      routes: (app) => {
        app.route(TUNNEL_PATH, createTunnel(config));
        app.onError(createErrorHandler(config));
      },
      handler: (served) => {
        return wrapHandler(served, config);
      },
      shutdown: closeClient,
    }),
  };
}
