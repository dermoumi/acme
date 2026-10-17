import type { Kit } from "@acme/app";
import type { HealthStatus } from "@acme/health";
import type { SentryConfig } from "./server/config";
import { readSettings } from "./server/env";
import {
  createErrorCapture,
  createErrorReporter,
  type ReportError,
} from "./server/capture";
import { createTunnel } from "./server/tunnel";
import { closeClient, wrapHandler } from "#sentry";

declare module "@acme/app" {
  interface KitShared {
    reportError: ReportError;
  }
}

// Must match initSentry's own default, which is where the browser posts.
const TUNNEL_PATH = "/sentry";

/**
 * The Sentry kit: error reporting for the server and the browser both.
 *
 * Sends the client IP, the user set by `setUser`, and database query data.
 * Masks sensitive keys in JSON and form bodies and in query strings.
 * Sends any other body verbatim; on Workers, only text bodies are captured.
 * Never sends cookie or authorization headers.
 *
 * A sub-app setting its own `onError` is not covered.
 *
 * Reports itself to `@acme/health`, so an app declares that one too, in any
 * order.
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
    requires: ["@acme/health"],
    init: ({ register, require }) => {
      const addHealthStatus = require("addHealthStatus");
      addHealthStatus("sentry", sentryStatus, { optional: true });
      register("reportError", createErrorReporter(config));
      register("captureError", createErrorCapture(config));

      return {
        routes: (app) => {
          app.route(TUNNEL_PATH, createTunnel(config));
        },
        handler: (served) => {
          return wrapHandler(served, config);
        },
        shutdown: closeClient,
      };
    },
  };
}
