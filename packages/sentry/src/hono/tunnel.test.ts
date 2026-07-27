import { expect, test, vi } from "vitest";
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

test("swaps the fake dsn for the real one before forwarding", async () => {
  const { status, forwarded } = await send(post(envelope()));
  expect(status).toBe(200);

  const body = await forwarded?.text();
  const header = JSON.parse(body?.split("\n")[0] ?? "{}") as { dsn: string };
  expect(header.dsn).toBe(DSN);
  expect(body).toContain('{"type":"event"}');
});

test("forwards to the ingest endpoint derived from the real dsn", async () => {
  const { forwarded } = await send(post(envelope()));
  expect(forwarded?.url).toBe("https://dummy.ingest.sentry.io/api/1/envelope/");
});

// Without a dsn the route must not exist: the client falls back to dropping events.
test("404s when no dsn is configured, so nothing leaks upstream", async () => {
  const { status, forwarded } = await send(post(envelope()), {});
  expect(status).toBe(404);
  expect(forwarded).toBeUndefined();
});

test("rejects a cross origin post", async () => {
  const { status } = await send(
    post(envelope(), { Origin: "https://evil.test" }),
  );
  expect(status).toBe(403);
});

test("rejects a post with no origin at all", async () => {
  const body = envelope();
  const bare = new Request(`${ORIGIN}/`, {
    method: "POST",
    headers: { "Content-Length": String(body.length) },
    body,
  });
  expect((await send(bare)).status).toBe(403);
});

test("refuses an oversized envelope before reading it", async () => {
  const { status, forwarded } = await send(
    post(envelope(), { "Content-Length": String(2 * 1024 * 1024) }),
  );
  expect(status).toBe(413);
  expect(forwarded).toBeUndefined();
});

test("rejects a body that is not an envelope", async () => {
  expect((await send(post("not-an-envelope"))).status).toBe(400);
});

test("reports upstream failure as a bad gateway", async () => {
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
