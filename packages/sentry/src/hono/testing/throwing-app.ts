import { Hono } from "hono";
import type { SentryBindings } from "../bindings";
import type { SentryConfig } from "../../shared/config";

export const BOOM = "route exploded";

export function throwingApp(): Hono<{ Bindings: SentryBindings }> {
  const app = new Hono<{ Bindings: SentryBindings }>();
  app.post("/session", () => {
    throw new Error(BOOM);
  });
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
