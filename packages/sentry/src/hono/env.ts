import type { SentryConfig } from "./config";

// The name each setting has when an app names none, keyed by the config field
// that renames it.
const DEFAULTS = {
  dsnVar: "SENTRY_DSN",
  appNameVar: "APP_NAME",
  appEnvVar: "APP_ENV",
  appVersionVar: "APP_VERSION",
  appRevisionVar: "APP_REVISION",
} as const;

// Named at runtime, so the lookup is by string rather than by property. An
// empty value counts as absent: a deployment clears one by blanking it.
export function readEnv(
  env: unknown,
  config: SentryConfig,
  setting: keyof typeof DEFAULTS,
): string | undefined {
  const name = config[setting] ?? DEFAULTS[setting];
  const held = (env as Record<string, unknown> | undefined)?.[name];

  return typeof held === "string" && held ? held : undefined;
}
