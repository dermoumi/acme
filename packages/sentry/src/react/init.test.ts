import { getClient, getCurrentScope } from "@sentry/core";
import { afterEach, expect, test } from "vitest";
import { sentryOptions } from "../hono/options";
import { initSentryClient } from "./init";

const APP = "posy";
const VERSION = "1.2.3";
const REVISION = "abc1234";

afterEach(() => {
  getCurrentScope().setClient(undefined);
});

test("composes the release from the app, version and build", () => {
  initSentryClient({ app: APP, release: VERSION, dist: REVISION });
  expect(getClient()?.getOptions().release).toBe("posy@1.2.3+abc1234");
});

// Maps upload against the server's release, so a mismatch loses every browser trace.
test("reports the same release the server does", () => {
  initSentryClient({ app: APP, release: VERSION, dist: REVISION });
  const server = sentryOptions({
    SENTRY_DSN: "https://public@o0.ingest.sentry.io/0",
    APP_NAME: APP,
    APP_VERSION: VERSION,
    APP_REVISION: REVISION,
  });
  expect(getClient()?.getOptions().release).toBe(server?.release);
});
