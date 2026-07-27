import type { SentryBindings } from "../bindings";
import type { SentryConfig } from "../../shared/config";

export const DSN = "https://dummy@dummy.ingest.sentry.io/1";
export const SESSION = "DUMMY-QUERY-TOKEN";
export const COOKIE = "DUMMY-COOKIE-VALUE";
export const PASSWORD = "DUMMY-PLAINTEXT-PASSWORD";
export const BEARER = "DUMMY-BEARER-CREDENTIAL";
export const NOTE = "DUMMY-HARMLESS-NOTE";

export interface Capture {
  invoke: (request: Request) => Promise<Response>;
  sent: unknown[];
}

// Both runtimes bind this: the test imports it and never learns which one it runs on.
export interface Bench {
  build: (env: SentryBindings, config: SentryConfig) => Capture;
  settle: () => Promise<void>;
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
