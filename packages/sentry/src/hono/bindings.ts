/**
 * Environment values the package reads. Extend this from the app's own bindings
 * interface so `env` can be passed to `withSentry` without casting.
 *
 * With no `SENTRY_DSN`, capture is disabled and the app is otherwise unaffected.
 */
export interface SentryBindings {
  /** Ingestion key. Absent disables capture. */
  SENTRY_DSN?: string;
  /**
   * Deploy tier, e.g. `production`, `staging`, `preview`. Defaults to
   * `development`. Not Sentry-specific; anything needing the tier can read it.
   */
  APP_ENV?: string;
  /**
   * App version, typically from package.json. Reported as Sentry's `release`.
   * Not Sentry-specific; anything needing the version can read it.
   */
  APP_VERSION?: string;
  /**
   * Build identifier, typically a short commit sha. Reported as Sentry's `dist`
   * to tell builds of one release apart. Not Sentry-specific; a health endpoint
   * can report it so a deploy check knows which build answered.
   */
  APP_REVISION?: string;
}
