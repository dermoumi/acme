import { getCurrentScope } from "@sentry/core";
import { flush } from "@sentry/node";
import type { Bench } from "./contract";
import { recordingConfig, wireApp } from "./wired-app";

export const bench: Bench = {
  // Node reads its settings from process.env at startup, so drive that here.
  build: (env, config) => {
    const sent: unknown[] = [];
    const previous = process.env.SENTRY_DSN;
    if (env.SENTRY_DSN) process.env.SENTRY_DSN = env.SENTRY_DSN;
    else delete process.env.SENTRY_DSN;

    // init() sets a process-wide client, so a previous test would leave one
    // behind and this bench would not represent a process without a DSN.
    if (!env.SENTRY_DSN) getCurrentScope().setClient(undefined);
    const recorded = recordingConfig(config, sent);
    const handler = wireApp(recorded);
    // Assigning undefined would store the string "undefined", which is truthy.
    if (previous === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = previous;

    return {
      invoke: async (request) => handler.fetch(request, env),
      sent,
    };
  },
  settle: async () => {
    await flush();
  },
};
