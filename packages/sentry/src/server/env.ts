import type { SentryConfig, SentrySettings } from "./config";

function dropEmpty(value: string | undefined): string | undefined {
  return value === "" ? undefined : value;
}

export function readSettings(
  env: unknown,
  config: SentryConfig,
): SentrySettings {
  const values = (env ?? {}) as Record<string, string | undefined>;
  const named = config.settings?.(values) ?? {};

  return {
    dsn: dropEmpty(named.dsn ?? values.SENTRY_DSN),
    appName: dropEmpty(named.appName ?? values.APP_NAME),
    appEnv: dropEmpty(named.appEnv ?? values.APP_ENV),
    appVersion: dropEmpty(named.appVersion ?? values.APP_VERSION),
    appRevision: dropEmpty(named.appRevision ?? values.APP_REVISION),
  };
}
