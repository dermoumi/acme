import type { ErrorEvent, Options } from "@sentry/core";
import { readEnv } from "./env";
import { buildReleaseName } from "../release";
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
export function buildSentryOptions(
  env: unknown,
  config: SentryConfig = {},
): Options | undefined {
  const dsn = readEnv(env, config, "dsnVar");
  if (!dsn) return undefined;

  const masking = config.masking ?? "full";
  const keys = [...DEFAULT_REDACT_KEYS, ...(config.redactKeys ?? [])];
  const revision = readEnv(env, config, "appRevisionVar");
  const release = buildReleaseName(
    readEnv(env, config, "appNameVar"),
    readEnv(env, config, "appVersionVar"),
    revision,
  );

  return {
    dsn,
    environment: readEnv(env, config, "appEnvVar") ?? "development",
    release,
    dist: revision ?? "dev",
    dataCollection: dataCollection(masking),
    beforeSend: beforeSend(masking, keys),
    ...config.options,
  };
}
