// Re-exported so apps need no direct @sentry/react dependency.
export { addBreadcrumb, captureMessage, ErrorBoundary } from "@sentry/react";
export { type ClientSentryConfig, initSentryClient } from "./init";
