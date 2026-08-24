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

/** Pass the same object to `withSentry` and `sentryTunnel` so both apply one policy. */
export interface SentryConfig {
  /**
   * Name of the value holding the DSN. Defaults to `SENTRY_DSN`.
   *
   * This and the four below name a binding on workers and an environment
   * variable on node, and rename it for this package alone: whatever else an
   * app reads them by is the app's own business.
   */
  dsnVar?: string;
  /**
   * Name of the value holding the app's name. Defaults to `APP_NAME`.
   */
  appNameVar?: string;
  /**
   * Name of the value holding the deploy tier. Defaults to `APP_ENV`.
   */
  appEnvVar?: string;
  /**
   * Name of the value holding the app's version. Defaults to `APP_VERSION`.
   */
  appVersionVar?: string;
  /**
   * Name of the value holding the build identifier. Defaults to `APP_REVISION`.
   */
  appRevisionVar?: string;
  /** Defaults to `"full"`. */
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
  /** Merged into the Sentry client options last, overriding the rest. */
  options?: Partial<Options>;
}

// Both runtimes expose this shape, so an app's entry reads the same either way.
export interface SentryHandler<Bindings> {
  fetch: (
    request: Request,
    env: Bindings,
    ctx?: unknown,
  ) => Response | Promise<Response>;
}
