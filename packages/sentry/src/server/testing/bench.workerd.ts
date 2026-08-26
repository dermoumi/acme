import type { ExecutionContext } from "@cloudflare/workers-types";
import { getCurrentScope } from "@sentry/core";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import type { Bench } from "./contract";
import { recordingConfig, wireApp } from "./wired-app";

let latest: ExecutionContext | undefined;

export const bench: Bench = {
  build: (env, config) => {
    const sent: unknown[] = [];
    // Requests share the current scope, so a prior test's client would linger.
    if (!env.SENTRY_DSN) getCurrentScope().setClient(undefined);
    const recorded = recordingConfig(config, sent);
    const handler = wireApp(recorded);

    return {
      invoke: async (request) => {
        const ctx = createExecutionContext();
        latest = ctx;

        return handler.fetch(request, env, ctx);
      },
      sent,
    };
  },
  // Sentry sends through waitUntil; this is what makes the send observable.
  settle: async () => {
    if (latest) await waitOnExecutionContext(latest);
  },
};
