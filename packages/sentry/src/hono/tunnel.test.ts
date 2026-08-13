import { describe, expect, it, vi } from "vitest";
import type { SentryBindings } from "./bindings";
import { DSN } from "./testing/contract";
import { sentryTunnel } from "./tunnel";

const ORIGIN = "https://posy.test";

function envelope(dsn = "https://reporter@errors.internal/0"): string {
  return `${JSON.stringify({ dsn, event_id: "abc" })}\n{"type":"event"}\n{}`;
}

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/`, {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Content-Length": String(body.length),
      ...headers,
    },
    body,
  });
}

async function send(
  request: Request,
  env?: SentryBindings,
): Promise<{ status: number; forwarded: Request | undefined }> {
  let forwarded: Request | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((...args: Parameters<typeof fetch>) => {
      forwarded = new Request(...args);
      return Promise.resolve(new Response(null, { status: 200 }));
    }),
  );
  try {
    const res = await sentryTunnel().fetch(request, env ?? { SENTRY_DSN: DSN });
    return { status: res.status, forwarded };
  } finally {
    vi.unstubAllGlobals();
  }
}

describe("sentryTunnel", () => {
  it("swaps the fake dsn for the real one before forwarding", async () => {
    const { status, forwarded } = await send(post(envelope()));
    expect(status).toBe(200);

    const raw = await forwarded?.arrayBuffer();
    const body = new TextDecoder().decode(raw);
    const header = JSON.parse(body.split("\n")[0] ?? "{}") as { dsn: string };
    expect(header.dsn).toBe(DSN);
    expect(body).toContain('{"type":"event"}');
  });

  it("forwards to the ingest endpoint derived from the real dsn", async () => {
    const { forwarded } = await send(post(envelope()));
    expect(forwarded?.url).toBe(
      "https://dummy.ingest.sentry.io/api/1/envelope/",
    );
  });

  // Without a dsn the route must not exist: the client falls back to dropping events.
  it("404s when no dsn is configured, so nothing leaks upstream", async () => {
    const { status, forwarded } = await send(post(envelope()), {});
    expect(status).toBe(404);
    expect(forwarded).toBeUndefined();
  });

  it("rejects a cross origin post", async () => {
    const { status } = await send(
      post(envelope(), { Origin: "https://evil.test" }),
    );
    expect(status).toBe(403);
  });

  it("rejects a post with no origin at all", async () => {
    const body = envelope();
    const bare = new Request(`${ORIGIN}/`, {
      method: "POST",
      headers: { "Content-Length": String(body.length) },
      body,
    });
    expect((await send(bare)).status).toBe(403);
  });

  it("refuses an oversized envelope before reading it", async () => {
    const { status, forwarded } = await send(
      post(envelope(), { "Content-Length": String(2 * 1024 * 1024) }),
    );
    expect(status).toBe(413);
    expect(forwarded).toBeUndefined();
  });

  it("rejects a body that is not an envelope", async () => {
    expect((await send(post("not-an-envelope"))).status).toBe(400);
  });

  it("reports upstream failure as a bad gateway", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(null, { status: 500 })),
    );
    try {
      const res = await sentryTunnel().fetch(post(envelope()), {
        SENTRY_DSN: DSN,
      });
      expect(res.status).toBe(502);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  function eventEnvelope(): string {
    return [
      JSON.stringify({ dsn: "https://reporter@errors.internal/0" }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({
        message: "boom",
        request: {
          headers: { Authorization: "Bearer LEAK", "User-Agent": "probe" },
          data: JSON.stringify({ username: "her", password: "PLAINPASS" }),
        },
      }),
    ].join("\n");
  }

  async function forwardedBody(
    tunnel: ReturnType<typeof sentryTunnel>,
    body: string,
  ): Promise<string> {
    let sent = "";
    vi.stubGlobal(
      "fetch",
      vi.fn((...args: Parameters<typeof fetch>) => {
        const payload = args[1]?.body;
        sent =
          typeof payload === "string"
            ? payload
            : new TextDecoder().decode(payload as Uint8Array);
        return Promise.resolve(new Response(null, { status: 200 }));
      }),
    );
    try {
      await tunnel.fetch(post(body), { SENTRY_DSN: DSN });
      return sent;
    } finally {
      vi.unstubAllGlobals();
    }
  }

  it("masks client event bodies on their way through", async () => {
    const sent = await forwardedBody(
      sentryTunnel({ masking: "light" }),
      eventEnvelope(),
    );
    expect(sent).toContain("her");
    expect(sent).not.toContain("PLAINPASS");
    expect(sent).not.toContain("LEAK");
  });

  it("masking none keeps values but still drops credentials", async () => {
    const sent = await forwardedBody(
      sentryTunnel({ masking: "none" }),
      eventEnvelope(),
    );
    expect(sent).toContain("PLAINPASS");
    expect(sent).not.toContain("LEAK");
  });

  it("redactKeys reaches client events too", async () => {
    const tunnel = sentryTunnel({ masking: "light", redactKeys: ["username"] });
    const sent = await forwardedBody(tunnel, eventEnvelope());
    expect(sent).not.toContain("her");
  });

  // Only "event" items are ours to rewrite. The payload deliberately carries a
  // scrubbable request, so over-scrubbing would show up here.
  it("passes non-event items through untouched", async () => {
    const body = [
      JSON.stringify({ dsn: "https://reporter@errors.internal/0" }),
      JSON.stringify({ type: "transaction" }),
      JSON.stringify({
        sid: "abc",
        request: {
          headers: { Authorization: "Bearer LEAK" },
          data: JSON.stringify({ password: "PLAINPASS" }),
        },
      }),
    ].join("\n");
    const sent = await forwardedBody(sentryTunnel({ masking: "full" }), body);
    expect(sent).toContain("PLAINPASS");
    expect(sent).toContain("LEAK");
    expect(sent).toContain('"sid":"abc"');
  });

  it("still swaps the dsn while scrubbing", async () => {
    const sent = await forwardedBody(sentryTunnel(), eventEnvelope());
    expect(JSON.parse(sent.split("\n")[0] ?? "{}")).toMatchObject({ dsn: DSN });
  });
});
