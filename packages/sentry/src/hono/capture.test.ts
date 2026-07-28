import { bench } from "#testing/bench";
import { expect, test } from "vitest";
import type { SentryBindings } from "./bindings";
import type { SentryConfig } from "./config";
import {
  BEARER,
  COOKIE,
  DSN,
  loginRequest,
  NOTE,
  PASSWORD,
  SESSION,
} from "./testing/contract";
import { BOOM } from "./testing/throwing-app";

async function capture(
  env: SentryBindings,
  config: SentryConfig = {},
): Promise<{ res: Response; body: string }> {
  const { invoke, sent } = bench.build(env, config);
  const res = await invoke(loginRequest());
  await bench.settle();
  return { res, body: JSON.stringify(sent) };
}

test("captures an error thrown inside a route handler", async () => {
  const { res, body } = await capture({ SENTRY_DSN: DSN });
  expect(res.status).toBe(500);
  expect(body).toContain(BOOM);
});

test("captures nothing and still answers when no DSN is configured", async () => {
  const { res, body } = await capture({});
  expect(res.status).toBe(500);
  expect(body).toBe("[]");
});

test("keeps the body and harmless query for debugging", async () => {
  const { body } = await capture({ SENTRY_DSN: DSN });
  expect(body).toContain("tester");
  expect(body).toContain(NOTE);
  expect(body).toContain("page=3");
});

test("masks credentials without dropping the surrounding context", async () => {
  const { body } = await capture({ SENTRY_DSN: DSN });
  expect(body).not.toContain(PASSWORD);
  expect(body).not.toContain(BEARER);
  expect(body).not.toContain(SESSION);
  expect(body).not.toContain(COOKIE);
});

test("redactKeys masks a project specific field", async () => {
  const { body } = await capture({ SENTRY_DSN: DSN }, { redactKeys: ["note"] });
  expect(body).toContain("tester");
  expect(body).not.toContain(NOTE);
});

// none keeps request values; credentials are not request values.
test("masking none sends values verbatim but never credentials", async () => {
  const { body } = await capture({ SENTRY_DSN: DSN }, { masking: "none" });
  expect(body).toContain(PASSWORD);
  expect(body).toContain(SESSION);
  expect(body).not.toContain(BEARER);
  expect(body).not.toContain(COOKIE);
});

// Delivery must not depend on waitUntil, which races isolate teardown once the
// client has its response. No settle() here on purpose.
test("the event is sent before the response resolves", async () => {
  const { invoke, sent } = bench.build({ SENTRY_DSN: DSN }, {});
  await invoke(loginRequest());
  expect(JSON.stringify(sent)).toContain(BOOM);
});

test("the 500 body carries the event id so a user can quote it", async () => {
  const { invoke } = bench.build({ SENTRY_DSN: DSN }, {});
  const res = await invoke(loginRequest());
  const body = (await res.json()) as { sentryEventId: string | null };
  expect(body.sentryEventId).toMatch(/^[a-f0-9]{32}$/u);
});

test("with no DSN the id is null rather than absent", async () => {
  const { invoke } = bench.build({}, {});
  const res = await invoke(loginRequest());
  expect(await res.json()).toEqual({
    error: "Internal Server Error",
    sentryEventId: null,
  });
});

// The CI health probe hits every deploy; its failures are already reported by CI.
test("ignoreUserAgent skips capture for a matching caller", async () => {
  const { invoke, sent } = bench.build(
    { SENTRY_DSN: DSN },
    { ignoreUserAgent: "acme-ci-health-probe" },
  );
  const request = loginRequest();
  request.headers.set("user-agent", "acme-ci-health-probe");
  const res = await invoke(request);

  expect(res.status).toBe(500);
  expect(sent).toEqual([]);
});

test("a different user agent is still captured", async () => {
  const { invoke, sent } = bench.build(
    { SENTRY_DSN: DSN },
    { ignoreUserAgent: "acme-ci-health-probe" },
  );
  await invoke(loginRequest());
  expect(JSON.stringify(sent)).toContain(BOOM);
});
