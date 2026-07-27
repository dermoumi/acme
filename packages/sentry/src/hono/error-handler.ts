import { captureException } from "@sentry/cloudflare";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

// Hono answers route errors itself, so withSentry never sees them: this is their only capture path.
export function sentryErrorHandler(): ErrorHandler {
  return (error, ctx) => {
    const expected = error instanceof HTTPException && error.status < 500;
    if (!expected) {
      console.error(error);
      captureException(error);
    }

    if (error instanceof HTTPException) return error.getResponse();
    return ctx.text("Internal Server Error", 500);
  };
}
