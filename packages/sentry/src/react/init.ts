import {
  breadcrumbsIntegration,
  dedupeIntegration,
  functionToStringIntegration,
  globalHandlersIntegration,
  init,
  linkedErrorsIntegration,
  makeFetchTransport,
} from "@sentry/react";
import type { SentryConfig } from "../shared/config";
import {
  DEFAULT_REDACT_KEYS,
  scrubEvent,
  stripCredentials,
} from "../shared/scrub";
import { stopWhenUnconfigured } from "./transport";

// The browser never holds the real dsn; the tunnel swaps it in server-side.
const PLACEHOLDER_DSN = "https://reporter@errors.internal/0";

export interface ClientSentryConfig extends SentryConfig {
  /** Path of the tunnel route mounted from @acme/sentry/hono. */
  tunnel?: string;
  /** Supplied by the app: the package takes no view on build-time var names. */
  environment?: string;
  release?: string;
}

// Errors only: tracing costs bundle, fetch patching and separate quota.
export function initSentryClient(config: ClientSentryConfig = {}): void {
  const masking = config.masking ?? "full";
  const keys = [...DEFAULT_REDACT_KEYS, ...(config.redactKeys ?? [])];

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
    beforeSend:
      masking === "none"
        ? stripCredentials
        : (event) => scrubEvent(event, keys),
    ...config.options,
  });
}
