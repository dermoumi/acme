import type { Options } from "@sentry/core";
import { readSettings } from "./env";
import { buildReleaseName } from "@acme/app";
import type { SentryConfig } from "./config";
import { DEFAULT_REDACT_KEYS, SENSITIVE_HEADERS, scrubEvent } from "./scrub";

type DataCollection = NonNullable<Options["dataCollection"]>;

// Withheld at every level: a session token is impersonation material, not data.
const CREDENTIALS = {
  cookies: false,
  httpHeaders: { request: { deny: SENSITIVE_HEADERS }, response: false },
  genAI: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
} satisfies Partial<DataCollection>;

// Naming dataCollection flips every unlisted category permissive: list all.
const DATA_COLLECTION = {
  ...CREDENTIALS,
  httpBodies: ["incomingRequest"],
  urlQueryParams: true,
  userInfo: true,
  databaseQueryData: true,
} satisfies DataCollection;

// No DSN means no client: monitoring must never fail closed.
export function buildSentryOptions(
  env: unknown,
  config: SentryConfig = {},
): Options | undefined {
  const settings = readSettings(env, config);
  if (!settings.dsn) return undefined;

  const keys = [...DEFAULT_REDACT_KEYS, ...(config.redactKeys ?? [])];
  const release = buildReleaseName(
    settings.appName,
    settings.appVersion,
    settings.appRevision,
  );

  return {
    dsn: settings.dsn,
    environment: settings.appEnv ?? "development",
    release,
    dist: settings.appRevision ?? "dev",
    dataCollection: DATA_COLLECTION,
    beforeSend: (event) => scrubEvent(event, keys),
    ...config.options,
  };
}
