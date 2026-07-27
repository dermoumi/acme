import { captureException, flush } from "@sentry/core";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

// A ceiling, not a wait: low so a slow Sentry cannot delay error responses.
const FLUSH_MS = 500;

// Hono answers route errors itself, so withSentry never sees them: this is their only capture path.
export function sentryErrorHandler(): ErrorHandler {
  return async (error, ctx) => {
    const expected = error instanceof HTTPException && error.status < 500;
    if (!expected) {
      console.error(error);
      captureException(error);
      // Answering can end the runtime's work, so deliver before answering.
      await flush(FLUSH_MS).catch(() => false);
    }

    if (error instanceof HTTPException) return error.getResponse();
    return ctx.text("Internal Server Error", 500);
  };
}
