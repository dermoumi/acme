import type { Options } from "@sentry/core";
import type { SentryBindings } from "./bindings";
import { DEFAULT_REDACT_KEYS, SENSITIVE_HEADERS, scrubEvent } from "./scrub";

type DataCollection = NonNullable<Options["dataCollection"]>;

// Naming dataCollection at all flips every unlisted category permissive, so list them.
const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { deny: SENSITIVE_HEADERS }, response: false },
  // Kept for debugging; sensitive keys inside them are redacted in beforeSend.
  httpBodies: ["incomingRequest"],
  urlQueryParams: true,
  databaseQueryData: true,
  genAI: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
} satisfies DataCollection;

// No DSN means no client: monitoring must never fail closed.
export function sentryOptions(
  env: SentryBindings,
  redactKeys: string[] = [],
): Options | undefined {
  if (!env.SENTRY_DSN) return undefined;

  const keys = [...DEFAULT_REDACT_KEYS, ...redactKeys];
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? "development",
    release: env.SENTRY_RELEASE,
    dist: env.SENTRY_DIST,
    dataCollection: DATA_COLLECTION,
    beforeSend: (event) => scrubEvent(event, keys),
  };
}
