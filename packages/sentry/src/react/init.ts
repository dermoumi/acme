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

export interface ClientSentryConfig {
  /** Path of the tunnel route mounted from @acme/sentry/hono. */
  tunnel?: string;
  /** Supplied by the app: the package takes no view on build-time var names. */
  environment?: string;
  release?: string;
  /** Escape hatch for tests and future composition. */
  options?: Partial<Options>;
}

// No masking here: the tunnel scrubs on the way through, so one server setting
// governs both halves and none of that code ships to the browser.
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
