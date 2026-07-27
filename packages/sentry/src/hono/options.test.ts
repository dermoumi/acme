import { expect, test } from "vitest";
import { sentryOptions } from "./options";

const DSN = "https://dummy@dummy.ingest.sentry.io/1";

test("no DSN yields no options, so monitoring stays a silent no-op", () => {
  expect(sentryOptions({})).toBeUndefined();
  expect(sentryOptions({ SENTRY_ENVIRONMENT: "staging" })).toBeUndefined();
});

test("carries the dsn, environment and release through", () => {
  const options = sentryOptions({
    SENTRY_DSN: DSN,
    SENTRY_ENVIRONMENT: "production",
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
test("every data collection category is locked off", () => {
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
    databaseQueryData: true,
    genAI: { inputs: false, outputs: false },
    graphQL: { document: false, variables: false },
  });
});
