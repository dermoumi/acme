import type { Options } from "@sentry/core";

/**
 * How much request data is masked before an event is sent.
 *
 * - `none`: body and query values kept verbatim
 * - `light`: values masked when their key looks sensitive
 * - `full`: also withholds database query data, user info (ip, user id), and
 *   bodies neither JSON nor form-encoded, which cannot be masked key by key
 *
 * Cookies and authorization headers are stripped at every level, `none` included.
 */
export type MaskingLevel = "none" | "light" | "full";

/**
 * What the package reads out of the environment.
 */
export interface SentrySettings {
  dsn?: string;
  appName?: string;
  appEnv?: string;
  appVersion?: string;
  appRevision?: string;
}

/**
 * What an app declares the Sentry kit with.
 */
export interface SentryConfig {
  /**
   * Where each setting comes from. Defaults to `SENTRY_DSN`, `APP_NAME`,
   * `APP_ENV`, `APP_VERSION` and `APP_REVISION`.
   *
   * A setting it leaves out keeps its default name.
   */
  settings?: (env: Record<string, string | undefined>) => SentrySettings;
  /**
   * Defaults to `"full"`.
   */
  masking?: MaskingLevel;
  /**
   * Extra keys to mask, across body, query string, url and cookies.
   * Case-insensitive substring match, so `"note"` also masks `userNote`.
   * A matching header is dropped rather than masked, as credentials are.
   * Unused when masking is `"none"`.
   */
  redactKeys?: string[];
  /**
   * User-Agent whose errors are never captured, matched exactly. For a caller
   * whose failures are expected and already handled, such as a CI health probe.
   */
  ignoreUserAgent?: string;
  /**
   * Merged into the Sentry client options last, overriding the rest.
   */
  options?: Partial<Options>;
}
