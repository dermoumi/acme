import { captureException, flush, getClient } from "@sentry/core";
import type { Context, ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { SentryConfig } from "./config";

// A ceiling, not a wait: low so a slow Sentry cannot delay error responses.
const FLUSH_MS = 500;

/**
 * Reports an error a kit caught itself, so it never reached `onError`.
 */
export type ReportError = (ctx: Context, error: unknown) => void;

function isIgnoredCaller(ctx: Context, config: SentryConfig): boolean {
  return (
    config.ignoreUserAgent !== undefined &&
    ctx.req.header("user-agent") === config.ignoreUserAgent
  );
}

// Unlike onError, no flush: the request wrapper sends once the response is out.
export function createErrorReporter(config: SentryConfig = {}): ReportError {
  return (ctx, error) => {
    if (!isIgnoredCaller(ctx, config)) {
      captureException(error);
    }
  };
}

// Hono answers route errors itself, so the wrapper never sees them: this is
// their only capture path.
export function createErrorHandler(config: SentryConfig = {}): ErrorHandler {
  return async (error, ctx) => {
    const isExpected = error instanceof HTTPException && error.status < 500;

    let eventId: string | undefined;
    if (!isExpected && !isIgnoredCaller(ctx, config)) {
      console.error(error);
      const id = captureException(error);
      // Without a client nothing was sent, and a dead id is worse than none.
      eventId = getClient() ? id : undefined;
      // Answering can end the runtime's work, so deliver before answering.
      await flush(FLUSH_MS).catch(() => false);
    }

    if (error instanceof HTTPException) return error.getResponse();
    // The id lets someone quote the exact event when reporting a failure.
    return ctx.json(
      { error: "Internal Server Error", sentryEventId: eventId ?? null },
      500,
    );
  };
}
