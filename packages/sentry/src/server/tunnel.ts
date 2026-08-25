import {
  type Envelope,
  type ErrorEvent,
  parseEnvelope,
  serializeEnvelope,
} from "@sentry/core";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { MaskingLevel, SentryConfig } from "./config";
import { readSettings } from "./env";
import { DEFAULT_REDACT_KEYS, scrubEvent, stripCredentials } from "./scrub";

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

// Envelope items are a discriminated union of tuples, which does not survive a
// map; only "event" payloads are touched, so bridge the shape once here.
type LooseItem = [{ type?: string }, unknown];

// Round-tripping through Sentry's own codec keeps binary items and length
// headers correct, rather than hand-walking the envelope.
function rewriteEnvelope(
  body: Uint8Array,
  dsn: string,
  masking: MaskingLevel,
  keys: string[],
): string | Uint8Array {
  let parsed: Envelope;
  try {
    parsed = parseEnvelope(body);
  } catch {
    throw new HTTPException(400);
  }

  const [headers, items] = parsed as unknown as [
    Record<string, unknown>,
    LooseItem[],
  ];

  const scrubbed = items.map(([itemHeader, payload]): LooseItem => {
    if (itemHeader.type !== "event" || typeof payload !== "object") {
      return [itemHeader, payload];
    }
    const event = payload as ErrorEvent;
    return [
      itemHeader,
      masking === "none"
        ? stripCredentials(event)
        : scrubEvent(event, keys, masking === "light"),
    ];
  });

  return serializeEnvelope([
    { ...headers, dsn },
    scrubbed,
  ] as unknown as Envelope);
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

// Proxies the browser's envelopes, swapping its placeholder dsn for the real
// one, so the dsn stays out of the bundle and the post stays same-origin.
export function createTunnel(config: SentryConfig = {}): Hono {
  const tunnel = new Hono();
  const masking = config.masking ?? "full";
  const keys = [...DEFAULT_REDACT_KEYS, ...(config.redactKeys ?? [])];

  return tunnel.post("/", async (ctx) => {
    const { dsn } = readSettings(ctx.env, config);
    if (!dsn) throw new HTTPException(404);
    if (!sameOrigin(ctx.req.raw)) throw new HTTPException(403);

    const envelope = rewriteEnvelope(
      await readEnvelope(ctx.req.raw),
      dsn,
      masking,
      keys,
    );
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
