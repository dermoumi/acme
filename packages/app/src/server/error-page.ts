import type { Context, ErrorHandler } from "hono";
import { html } from "hono/html";
import { HTTPException } from "hono/http-exception";
import type { HtmlEscapedString } from "hono/utils/html";

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

// html escapes what it interpolates: a kit's CaptureError can answer anything.
function renderPage(
  reference: string | undefined,
): HtmlEscapedString | Promise<HtmlEscapedString> {
  const referenceLine = reference
    ? html`<p>Reference: <code>${reference}</code></p>`
    : "";

  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong</title>
      </head>
      <body
        style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem"
      >
        <h1>Something went wrong</h1>
        <p>The server could not answer this request. Try again in a moment.</p>
        ${referenceLine}
      </body>
    </html> `;
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

    let reference: string | undefined;
    if (!isExpected) {
      console.error(error);
      reference = await findCapture()?.(ctx, error);
    }

    if (error instanceof HTTPException) return error.getResponse();
    if (wantsHtml(ctx)) return ctx.html(renderPage(reference), 500);
    // The id lets someone quote the exact event when reporting a failure.
    const body = {
      error: "Internal Server Error",
      reference: reference ?? null,
    };
    return ctx.json(body, 500);
  };
}
