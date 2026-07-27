import {
  breadcrumbsIntegration,
  dedupeIntegration,
  functionToStringIntegration,
  globalHandlersIntegration,
  init,
  linkedErrorsIntegration,
  makeFetchTransport,
} from "@sentry/react";
import type { Options } from "@sentry/core";
import { stopWhenUnconfigured } from "./transport";

// The browser never holds the real dsn; the tunnel swaps it in server-side.
const PLACEHOLDER_DSN = "https://reporter@errors.internal/0";

/** Options for `initSentryClient`. */
export interface ClientSentryConfig {
  /** Path of the tunnel route mounted from `@acme/sentry/hono`. Defaults to `/sentry`. */
  tunnel?: string;
  /** Deploy tier to tag events with. Defaults to `development`. */
  environment?: string;
  /** Version the events belong to. Typically the app's package version. */
  release?: string;
  /** Merged into `Sentry.init` last, overriding the rest. */
  options?: Partial<Options>;
}

/**
 * Initialises the browser SDK. Call once, before rendering.
 *
 * ```ts
 * initSentryClient({
 *   environment: import.meta.env.VITE_APP_ENV,
 *   release: import.meta.env.VITE_APP_VERSION,
 * });
 * ```
 *
 * Events post to the tunnel route, which adds the real DSN and applies masking,
 * so neither the DSN nor any scrubbing code is in the bundle.
 *
 * Captures errors only; tracing and replay are not enabled.
 *
 * Safe to call when the server has no DSN: the tunnel answers 404 and the
 * transport then stops sending, costing one request per session.
 */
export function initSentryClient(config: ClientSentryConfig = {}): void {
  init({
    dsn: PLACEHOLDER_DSN,
    tunnel: config.tunnel ?? "/sentry",
    environment: config.environment ?? "development",
    release: config.release,
    transport: stopWhenUnconfigured(makeFetchTransport),
    integrations: [
      breadcrumbsIntegration(),
      dedupeIntegration(),
      functionToStringIntegration(),
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
    ],
    ...config.options,
  });
}
