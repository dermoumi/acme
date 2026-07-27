import type { CloudflareOptions } from "@sentry/cloudflare";
import type { SentryBindings } from "./bindings";
import { SENSITIVE_HEADERS, scrubEvent } from "./scrub";

type DataCollection = NonNullable<CloudflareOptions["dataCollection"]>;

// Naming dataCollection at all flips every unlisted category permissive, so list them.
const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { deny: SENSITIVE_HEADERS }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  genAI: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
} satisfies DataCollection;

// No DSN means no client: monitoring must never fail closed.
export function sentryOptions(
  env: SentryBindings,
): CloudflareOptions | undefined {
  if (!env.SENTRY_DSN) return undefined;

  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? "development",
    release: env.SENTRY_RELEASE,
    dataCollection: DATA_COLLECTION,
    beforeSend: scrubEvent,
  };
}
