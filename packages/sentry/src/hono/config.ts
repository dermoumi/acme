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
  /** Defaults to `"full"`. */
  masking?: MaskingLevel;
  /**
   * Extra keys to mask. Case-insensitive substring match, so `"note"` also
   * masks `userNote`. Unused when masking is `"none"`.
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
