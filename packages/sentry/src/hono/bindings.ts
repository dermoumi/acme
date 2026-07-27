// Host apps extend this so their env passes to withSentry() without casting.
export interface SentryBindings {
  SENTRY_DSN?: string;
  /** Deploy tier, shared with anything else that needs it. */
  APP_ENV?: string;
  SENTRY_RELEASE?: string;
  /** Distinguishes builds of one release; the version alone rarely moves. */
  SENTRY_DIST?: string;
}
