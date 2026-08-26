import { bench } from "#testing/bench";
import { describe, expect, it } from "vitest";
import type { SentryConfig } from "./config";
import {
  BEARER,
  type BenchEnv,
  COOKIE,
  DSN,
  loginRequest,
  NOTE,
  PASSWORD,
  SESSION,
} from "./testing/contract";
import { BOOM } from "./testing/wired-app";

async function capture(
  env: BenchEnv,
  config: SentryConfig = {},
): Promise<{ res: Response; body: string }> {
  const { invoke, sent } = bench.build(env, config);
  const res = await invoke(loginRequest());
  await bench.settle();
  return { res, body: JSON.stringify(sent) };
}

describe("createErrorHandler", () => {
  it("captures an error thrown inside a route handler", async () => {
    const { res, body } = await capture({ SENTRY_DSN: DSN });
    expect(res.status).toBe(500);
    expect(body).toContain(BOOM);
  });

  it("captures nothing and still answers when no DSN is configured", async () => {
    const { res, body } = await capture({});
    expect(res.status).toBe(500);
    expect(body).toBe("[]");
  });

  it("keeps the body and harmless query for debugging", async () => {
    const { body } = await capture({ SENTRY_DSN: DSN });
    expect(body).toContain("tester");
    expect(body).toContain(NOTE);
    expect(body).toContain("page=3");
  });

  it("masks credentials without dropping the surrounding context", async () => {
    const { body } = await capture({ SENTRY_DSN: DSN });
    expect(body).not.toContain(PASSWORD);
    expect(body).not.toContain(BEARER);
    expect(body).not.toContain(SESSION);
    expect(body).not.toContain(COOKIE);
  });

  it("masks a project specific field named by redactKeys", async () => {
    const { body } = await capture(
      { SENTRY_DSN: DSN },
      { redactKeys: ["note"] },
    );
    expect(body).toContain("tester");
    expect(body).not.toContain(NOTE);
  });

  it("sends values verbatim under masking none, but never credentials", async () => {
    const { body } = await capture({ SENTRY_DSN: DSN }, { masking: "none" });
    expect(body).toContain(PASSWORD);
    expect(body).toContain(SESSION);
    expect(body).not.toContain(BEARER);
    expect(body).not.toContain(COOKIE);
  });

  // Delivery must not depend on waitUntil, which races isolate teardown once
  // the client has its response. No settle() here on purpose.
  it("sends the event before the response resolves", async () => {
    const { invoke, sent } = bench.build({ SENTRY_DSN: DSN }, {});
    await invoke(loginRequest());
    expect(JSON.stringify(sent)).toContain(BOOM);
  });

  it("puts the event id in the 500 body, so a user can quote it", async () => {
    const { invoke } = bench.build({ SENTRY_DSN: DSN }, {});
    const res = await invoke(loginRequest());
    const body = (await res.json()) as { sentryEventId: string | null };
    expect(body.sentryEventId).toMatch(/^[a-f0-9]{32}$/u);
  });

  it("reports a null event id, rather than none, with no DSN", async () => {
    const { invoke } = bench.build({}, {});
    const res = await invoke(loginRequest());
    expect(await res.json()).toEqual({
      error: "Internal Server Error",
      sentryEventId: null,
    });
  });

  // CI failures are reported in the logs of the CI itself.
  it("skips capture for a caller ignoreUserAgent matches", async () => {
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

  it("still captures a different user agent", async () => {
    const { invoke, sent } = bench.build(
      { SENTRY_DSN: DSN },
      { ignoreUserAgent: "acme-ci-health-probe" },
    );
    await invoke(loginRequest());
    expect(JSON.stringify(sent)).toContain(BOOM);
  });
});
