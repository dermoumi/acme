import { bench } from "#testing/bench";
import { expect, test } from "vitest";
import type { SentryBindings } from "./bindings";
import type { SentryConfig } from "../shared/config";
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
