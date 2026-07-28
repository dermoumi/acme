import type { ErrorEvent, Options } from "@sentry/core";
import type { SentryBindings } from "./bindings";
import { releaseName } from "../release";
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
    userInfo: masking !== "full",
    databaseQueryData: masking !== "full",
  };
}

// userInfo only gates the ip Sentry infers, so an explicit setUser is dropped here.
function beforeSend(
  masking: MaskingLevel,
  keys: string[],
): (event: ErrorEvent) => ErrorEvent {
  const scrub =
    masking === "none"
      ? stripCredentials
      : (event: ErrorEvent) => scrubEvent(event, keys, masking === "light");
  if (masking !== "full") return scrub;
  return (event) => {
    const { user, ...rest } = scrub(event);
    return rest;
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
    release: releaseName(env.APP_NAME, env.APP_VERSION, env.APP_REVISION),
    dist: env.APP_REVISION ?? "dev",
    dataCollection: dataCollection(masking),
    beforeSend: beforeSend(masking, keys),
  };
}
