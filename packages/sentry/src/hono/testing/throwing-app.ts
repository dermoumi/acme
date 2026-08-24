import { Hono } from "hono";
import { sentryKit } from "../../kit";
import type { SentryBindings } from "../bindings";
import type { SentryConfig } from "../config";
import { setUser } from "../user";

export const BOOM = "route exploded";
export const IDENTIFIED = { id: "u_1", username: "tester" };

export function throwingApp(
  config: SentryConfig = {},
): Hono<{ Bindings: SentryBindings }> {
  const app = new Hono<{ Bindings: SentryBindings }>();
  app.post("/session", () => {
    throw new Error(BOOM);
  });
  app.post("/identified", () => {
    setUser(IDENTIFIED);
    throw new Error(BOOM);
  });
  // Wired as an app wires it: the kit installs the handler that captures onto
  // the client the wrapper established.
  sentryKit(config).init?.().routes?.(app);

  return app;
}

// Records envelopes instead of sending them, so captures are observable offline.
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
