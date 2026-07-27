import type { Options } from "@sentry/core";

export interface SentryConfig {
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
