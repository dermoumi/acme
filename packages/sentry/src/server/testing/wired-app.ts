import type { Handler } from "@acme/app";
import { Hono } from "hono";
import { sentryKit } from "../../kit";
import type { SentryConfig } from "../config";
import { setUser } from "../user";
import { kitContext } from "./contract";

export const BOOM = "route exploded";
export const IDENTIFIED = { id: "u_1", username: "tester" };

// An app that throws, wired through BOTH kit slots as `serve` would: neither
// captures alone, since one establishes the client the other reports onto.
export function wireApp(config: SentryConfig = {}): Handler {
  const app = new Hono();
  app.post("/session", () => {
    throw new Error(BOOM);
  });
  app.post("/identified", () => {
    setUser(IDENTIFIED);
    throw new Error(BOOM);
  });

  const state = sentryKit(config).init?.(kitContext()) ?? {};
  state.routes?.(app);

  return state.handler?.(app) ?? app;
}

// Records envelopes instead of sending, so captures are observable offline.
export function recordingConfig(
  config: SentryConfig,
  sent: unknown[],
): SentryConfig {
  return {
    ...config,
    options: {
      transport: () => ({
        send: (envelope) => {
          sent.push(envelope);
          return Promise.resolve({});
        },
        flush: () => Promise.resolve(true),
      }),
    },
  };
}
