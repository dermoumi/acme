import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { html } from "hono/html";
import { HTTPException } from "hono/http-exception";
import type { HtmlEscapedString } from "hono/utils/html";
import type {
  ClientErrorStatusCode,
  ContentfulStatusCode,
  ServerErrorStatusCode,
} from "hono/utils/http-status";
import { getErrorText } from "../internal/error-text";

/**
 * Reports an error `onError` caught, answering the event id or `undefined`.
 *
 * Resolve only once delivered: answering can end the runtime's work.
 */
export type CaptureError = (
  ctx: Context,
  error: unknown,
) => Promise<string | undefined>;

/**
 * The statuses an error page answers with.
 */
export type ErrorPageStatus = ClientErrorStatusCode | ServerErrorStatusCode;

/**
 * What an error page is rendered for.
 */
export interface ErrorPageDetails {
  status: ErrorPageStatus;
  /**
   * The reported event's id, when a kit reported one.
   */
  reference?: string;
}

/**
 * Renders the project's own page for an error.
 *
 * A throw falls back to the plain page `@acme/app` renders itself.
 */
export type RenderErrorPage = (
  ctx: Context,
  details: ErrorPageDetails,
) => Promise<Response>;

interface ErrorHandlerLookups {
  findCapture?: () => CaptureError | undefined;
  findPage?: () => RenderErrorPage | undefined;
}

// A placeholder until content negotiation exists; JSON stays the default.
function wantsHtml(ctx: Context): boolean {
  return ctx.req.header("accept")?.includes("text/html") ?? false;
}

// html escapes what it interpolates: a kit's CaptureError can answer anything.
function renderPage({
  status,
  reference,
}: ErrorPageDetails): HtmlEscapedString | Promise<HtmlEscapedString> {
  const { title, message } = getErrorText(status);
  const referenceLine = reference
    ? html`<p>Reference: <code>${reference}</code></p>`
    : "";

  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
      </head>
      <body
        style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem"
      >
        <h1>${title}</h1>
        <p>${message}</p>
        ${referenceLine}
      </body>
    </html> `;
}

async function renderHtml(
  ctx: Context,
  details: ErrorPageDetails,
  renderProjectPage: RenderErrorPage | undefined,
): Promise<Response> {
  if (renderProjectPage) {
    try {
      return await renderProjectPage(ctx, details);
    } catch (error) {
      console.error(error);
    }
  }

  const page = renderPage(details);
  return ctx.html(page, details.status);
}

function isErrorPageStatus(
  status: ContentfulStatusCode,
): status is ErrorPageStatus {
  return status >= 400;
}

// The page replaces the body only: a 401's WWW-Authenticate or a 429's
// Retry-After must still reach the client.
function copyHeaders(page: Response, source: Response | undefined): Response {
  if (source === undefined) return page;

  const headers = new Headers(page.headers);
  for (const [name, value] of source.headers) {
    if (name === "content-type" || name === "content-length") continue;
    if (name === "set-cookie") headers.append(name, value);
    else headers.set(name, value);
  }

  return new Response(page.body, { status: page.status, headers });
}

/**
 * Answers an error a route threw: a page for a browser, JSON otherwise.
 *
 * An `HTTPException` reaches anything but a browser as thrown.
 */
export function createErrorHandler({
  findCapture,
  findPage,
}: ErrorHandlerLookups = {}): ErrorHandler {
  return async (error, ctx) => {
    const isExpected = error instanceof HTTPException && error.status < 500;

    let reference: string | undefined;
    if (!isExpected) {
      console.error(error);
      reference = await findCapture?.()?.(ctx, error);
    }

    if (error instanceof HTTPException) {
      const { status } = error;
      if (!isErrorPageStatus(status) || !wantsHtml(ctx)) {
        return error.getResponse();
      }

      const details = { status, reference };
      const page = await renderHtml(ctx, details, findPage?.());
      return copyHeaders(page, error.res);
    }
    if (wantsHtml(ctx)) {
      return renderHtml(ctx, { status: 500, reference }, findPage?.());
    }
    // The id lets someone quote the exact event when reporting a failure.
    const body = {
      error: "Internal Server Error",
      reference: reference ?? null,
    };
    return ctx.json(body, 500);
  };
}

/**
 * Answers a path no route claimed: a page for a browser, Hono's text otherwise.
 */
export function createNotFoundHandler({
  findPage,
}: ErrorHandlerLookups = {}): NotFoundHandler {
  return async (ctx) => {
    if (!wantsHtml(ctx)) return ctx.text("404 Not Found", 404);

    return renderHtml(ctx, { status: 404 }, findPage?.());
  };
}
