import type { Context, ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * Reports an error `onError` caught, answering the event id or `undefined`.
 *
 * Resolve only once delivered: answering can end the runtime's work.
 */
export type CaptureError = (
  ctx: Context,
  error: unknown,
) => Promise<string | undefined>;

// A placeholder until content negotiation exists; JSON stays the default.
function wantsHtml(ctx: Context): boolean {
  return ctx.req.header("accept")?.includes("text/html") ?? false;
}

function renderPage(eventId: string | undefined): string {
  const reference = eventId ? `<p>Reference: <code>${eventId}</code></p>` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Something went wrong</title>
</head>
<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem">
<h1>Something went wrong</h1>
<p>The server could not answer this request. Try again in a moment.</p>
${reference}
</body>
</html>
`;
}

/**
 * Answers an error a route threw: a page for a browser, JSON otherwise.
 *
 * @param findCapture Looked up per error, so an app without one still answers.
 */
export function createErrorHandler(
  findCapture: () => CaptureError | undefined,
): ErrorHandler {
  return async (error, ctx) => {
    const isExpected = error instanceof HTTPException && error.status < 500;

    let eventId: string | undefined;
    if (!isExpected) {
      console.error(error);
      eventId = await findCapture()?.(ctx, error);
    }

    if (error instanceof HTTPException) return error.getResponse();
    if (wantsHtml(ctx)) return ctx.html(renderPage(eventId), 500);
    // The id lets someone quote the exact event when reporting a failure.
    return ctx.json(
      { error: "Internal Server Error", sentryEventId: eventId ?? null },
      500,
    );
  };
}
