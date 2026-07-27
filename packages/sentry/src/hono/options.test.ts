import { expect, test } from "vitest";
import type { MaskingLevel } from "./config";
import { sentryOptions } from "./options";

const DSN = "https://dummy@dummy.ingest.sentry.io/1";

test("no DSN yields no options, so monitoring stays a silent no-op", () => {
  expect(sentryOptions({})).toBeUndefined();
  expect(sentryOptions({ APP_ENV: "staging" })).toBeUndefined();
});

test("carries the dsn, environment and release through", () => {
  const options = sentryOptions({
    SENTRY_DSN: DSN,
    APP_ENV: "production",
    SENTRY_RELEASE: "1.2.3",
  });
  expect(options?.dsn).toBe(DSN);
  expect(options?.environment).toBe("production");
  expect(options?.release).toBe("1.2.3");
});

test("falls back to a development environment", () => {
  expect(sentryOptions({ SENTRY_DSN: DSN })?.environment).toBe("development");
});

test("scrubs every event before sending", () => {
  const beforeSend = sentryOptions({ SENTRY_DSN: DSN })?.beforeSend;
  const event = {
    type: undefined,
    request: { data: JSON.stringify({ password: "PLAINPASS" }) },
  };
  expect(JSON.stringify(beforeSend?.(event, {}))).not.toContain("PLAINPASS");
});

// Guards the trap: any category left unlisted silently reverts to permissive.
test("every data collection category is named, defaulting to full masking", () => {
  expect(sentryOptions({ SENTRY_DSN: DSN })?.dataCollection).toEqual({
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: {
        deny: ["authorization", "cookie", "proxy-authorization", "set-cookie"],
      },
      response: false,
    },
    httpBodies: ["incomingRequest"],
    urlQueryParams: true,
    databaseQueryData: false,
    genAI: { inputs: false, outputs: false },
    graphQL: { document: false, variables: false },
  });
});

test("only full withholds database query data", () => {
  const dbData = (masking: MaskingLevel) =>
    sentryOptions({ SENTRY_DSN: DSN }, { masking })?.dataCollection
      ?.databaseQueryData;
  expect(dbData("none")).toBe(true);
  expect(dbData("light")).toBe(true);
  expect(dbData("full")).toBe(false);
});

// Credentials are not part of the masking ladder; they go at every level.
test("none keeps values but still strips credentials", () => {
  const beforeSend = sentryOptions(
    { SENTRY_DSN: DSN },
    { masking: "none" },
  )?.beforeSend;
  const event = {
    type: undefined,
    request: {
      headers: { Authorization: "Bearer LEAK", "User-Agent": "probe" },
      data: JSON.stringify({ password: "PLAINPASS" }),
    },
  };
  const sent = JSON.stringify(beforeSend?.(event, {}));
  expect(sent).not.toContain("LEAK");
  expect(sent).toContain("probe");
  expect(sent).toContain("PLAINPASS");
});
