import { captureException, flush, getClient } from "@sentry/core";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

// A ceiling, not a wait: low so a slow Sentry cannot delay error responses.
const FLUSH_MS = 500;

// Hono answers route errors itself, so withSentry never sees them: this is their only capture path.
export function sentryErrorHandler(): ErrorHandler {
  return async (error, ctx) => {
    const expected = error instanceof HTTPException && error.status < 500;

    let eventId: string | undefined;
    if (!expected) {
      console.error(error);
      const id = captureException(error);
      // Without a client nothing was sent, and an unlookupable id is worse than none.
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
