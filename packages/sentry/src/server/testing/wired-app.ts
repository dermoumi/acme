import type { Handler } from "@acme/app";
import { Hono } from "hono";
import { sentryKit } from "../../kit";
import type { SentryConfig } from "../config";
import { setUser } from "../user";
import { stubHealthKit } from "@acme/app/testing";

export const BOOM = "route exploded";
export const CAUGHT = "caught by another kit";
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

  const { context } = stubHealthKit("@acme/sentry");
  const state = sentryKit(config).init?.(context) ?? {};
  const reportError = context.require("reportError");
  app.post("/caught", (ctx) => {
    reportError(ctx, new Error(CAUGHT));
    return ctx.text("answered by the kit", 500);
  });
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
