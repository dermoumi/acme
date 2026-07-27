import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { SentryBindings } from "./bindings";

const MAX_ENVELOPE_BYTES = 1024 * 1024;

// The browser holds a fake dsn, so the real one is only ever swapped in here.
function upstreamUrl(dsn: string): string {
  const url = new URL(dsn);
  const projectId = url.pathname.replaceAll("/", "");
  if (!/^\d+$/u.test(projectId)) {
    throw new HTTPException(500, { message: "malformed sentry dsn" });
  }
  return `${url.protocol}//${url.host}/api/${projectId}/envelope/`;
}

// Envelopes are newline delimited; only the header line carries the dsn.
function rewriteEnvelope(body: Uint8Array, dsn: string): Uint8Array {
  const newline = body.indexOf(0x0a);
  if (newline === -1) throw new HTTPException(400);

  let header: string;
  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(body.subarray(0, newline)),
    );
    if (typeof parsed !== "object" || parsed === null) {
      throw new HTTPException(400);
    }
    header = JSON.stringify({ ...parsed, dsn });
  } catch {
    throw new HTTPException(400);
  }

  const encoded = new TextEncoder().encode(header);
  const rest = body.subarray(newline);
  const rewritten = new Uint8Array(encoded.length + rest.length);
  rewritten.set(encoded, 0);
  rewritten.set(rest, encoded.length);
  return rewritten;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function readEnvelope(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length"));
  if (!Number.isInteger(declared) || declared <= 0) {
    throw new HTTPException(400);
  }
  if (declared > MAX_ENVELOPE_BYTES) throw new HTTPException(413);

  const body = new Uint8Array(await request.arrayBuffer());
  // A lying content-length must not become an unbounded forward.
  if (body.byteLength === 0 || body.byteLength > MAX_ENVELOPE_BYTES) {
    throw new HTTPException(body.byteLength === 0 ? 400 : 413);
  }
  return body;
}

export function sentryTunnel(): Hono<{ Bindings: SentryBindings }> {
  const tunnel = new Hono<{ Bindings: SentryBindings }>();

  return tunnel.post("/", async (ctx) => {
    const dsn = ctx.env.SENTRY_DSN;
    if (!dsn) throw new HTTPException(404);
    if (!sameOrigin(ctx.req.raw)) throw new HTTPException(403);

    const envelope = rewriteEnvelope(await readEnvelope(ctx.req.raw), dsn);
    const response = await fetch(upstreamUrl(dsn), {
      method: "POST",
      body: envelope,
      headers: { "Content-Type": "application/x-sentry-envelope" },
    }).catch(() => {
      throw new HTTPException(502);
    });

    if (!response.ok) throw new HTTPException(502);
    return ctx.body(null, 200);
  });
}
