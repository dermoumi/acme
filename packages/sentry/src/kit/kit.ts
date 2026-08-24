import type { Kit } from "@acme/app";
import type { SentryConfig } from "../hono/config";
import { sentryErrorHandler } from "../hono/error-handler";
import { sentryTunnel } from "../hono/tunnel";

// Where the browser posts unless the client was told otherwise, which is what
// initSentry defaults its own tunnel option to.
const TUNNEL_PATH = "/sentry";

/**
 * The Sentry kit: what an app reports its failures through.
 *
 * ```ts
 * kits: [sentryKit({ masking: "light" }), assetsKit()],
 * ```
 *
 * Contributes the tunnel the browser posts its events to, and the error handler
 * that captures whatever a route throws. Declare it before any kit mounting a
 * catch-all, which the tunnel would otherwise fall through to.
 *
 * The handler covers every route, a mounted sub-app's included, unless that
 * sub-app sets one of its own.
 *
 * @param config The masking policy this app applies, if not the defaults.
 */
export function sentryKit(config: SentryConfig = {}): Kit {
  return {
    name: "@acme/sentry",
    config,
    init: () => ({
      routes: (app) => {
        app.route(TUNNEL_PATH, sentryTunnel(config));
        app.onError(sentryErrorHandler(config));
      },
    }),
  };
}
