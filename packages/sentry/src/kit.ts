import type { Kit } from "@acme/app";
import type { HealthStatus } from "@acme/health";
import type { SentryConfig } from "./server/config";
import { readSettings } from "./server/env";
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
 *
 * Reports itself to `@acme/health`, so an app declares that one ahead of it.
 */
export function sentryKit(config: SentryConfig = {}): Kit {
  // Whether a DSN reached the app, not whether Sentry answers: capture is
  // fail-soft, so a DSN that never arrived is otherwise silent.
  const sentryStatus: HealthStatus = (ctx) => {
    return readSettings(ctx.env, config).dsn ? "configured" : "off";
  };

  return {
    name: "@acme/sentry",
    config,
    vite: "@acme/sentry/vite",
    init: ({ require }) => {
      const addHealthStatus = require("addHealthStatus");
      addHealthStatus("sentry", sentryStatus, { optional: true });

      return {
        routes: (app) => {
          app.route(TUNNEL_PATH, createTunnel(config));
          app.onError(createErrorHandler(config));
        },
        handler: (served) => {
          return wrapHandler(served, config);
        },
        shutdown: closeClient,
      };
    },
  };
}
