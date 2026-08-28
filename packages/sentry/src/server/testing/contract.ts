import { stubHealthKit } from "@acme/health/testing";
import type { KitContext } from "@acme/app";
import type { SentryConfig } from "../config";

export const DSN = "https://dummy@dummy.ingest.sentry.io/1";
export const SESSION = "DUMMY-QUERY-TOKEN";
export const COOKIE = "DUMMY-COOKIE-VALUE";
export const PASSWORD = "DUMMY-PLAINTEXT-PASSWORD";
export const BEARER = "DUMMY-BEARER-CREDENTIAL";
export const NOTE = "DUMMY-HARMLESS-NOTE";

// All a bench binds: the DSN, under the name an app that renames nothing gets.
export interface BenchEnv {
  SENTRY_DSN?: string;
}

export interface Capture {
  invoke: (request: Request) => Promise<Response>;
  sent: unknown[];
}

// Both runtimes bind this, so the test never learns which one it runs on.
export interface Bench {
  build: (env: BenchEnv, config: SentryConfig) => Capture;
  settle: () => Promise<void>;
}

// This kit reports to the health kit, so a test building it by hand stands in
// for the one an app would have declared.
export function kitContext(): KitContext {
  return stubHealthKit("@acme/sentry").context;
}

export function loginRequest(base = "https://posy.test"): Request {
  return new Request(`${base}/session?token=${SESSION}&page=3`, {
    method: "POST",
    headers: {
      Cookie: `posy_session=${COOKIE}`,
      Authorization: `Bearer ${BEARER}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "tester",
      password: PASSWORD,
      note: NOTE,
    }),
  });
}
