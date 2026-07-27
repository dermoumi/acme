import type { Options } from "@sentry/core";
import type { SentryBindings } from "./bindings";
import type { MaskingLevel, SentryConfig } from "./config";
import {
  DEFAULT_REDACT_KEYS,
  SENSITIVE_HEADERS,
  scrubEvent,
  stripCredentials,
} from "./scrub";

type DataCollection = NonNullable<Options["dataCollection"]>;

// Withheld at every level: a session token is impersonation material, not data.
const CREDENTIALS = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { deny: SENSITIVE_HEADERS }, response: false },
  genAI: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
} satisfies Partial<DataCollection>;

// Naming dataCollection at all flips every unlisted category permissive, so list them.
function dataCollection(masking: MaskingLevel): DataCollection {
  return {
    ...CREDENTIALS,
    httpBodies: ["incomingRequest"],
    urlQueryParams: true,
    databaseQueryData: masking !== "full",
  };
}

// No DSN means no client: monitoring must never fail closed.
export function sentryOptions(
  env: SentryBindings,
  config: SentryConfig = {},
): Options | undefined {
  if (!env.SENTRY_DSN) return undefined;

  const masking = config.masking ?? "full";
  const keys = [...DEFAULT_REDACT_KEYS, ...(config.redactKeys ?? [])];

  return {
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV ?? "development",
    release: env.SENTRY_RELEASE,
    dist: env.SENTRY_DIST,
    dataCollection: dataCollection(masking),
    beforeSend:
      masking === "none"
        ? stripCredentials
        : (event) => scrubEvent(event, keys),
  };
}
