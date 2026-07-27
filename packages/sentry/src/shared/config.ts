import type { Options } from "@sentry/core";

/** none keeps values verbatim; light masks sensitive keys; full also drops db query data. */
export type MaskingLevel = "none" | "light" | "full";

export interface SentryConfig {
  /** Defaults to "full": a project opts down deliberately, never by omission. */
  masking?: MaskingLevel;
  /** Extra body, query and cookie keys to mask. Substring matched. */
  redactKeys?: string[];
  /** Escape hatch for tests and future composition. */
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
