import type { ExecutionContext } from "@cloudflare/workers-types";
import { getCurrentScope } from "@sentry/core";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { withSentry } from "../workerd/handler";
import type { Bench } from "./contract";
import { recordingConfig, throwingApp } from "./throwing-app";

let latest: ExecutionContext | undefined;

export const bench: Bench = {
  build: (env, config) => {
    const sent: unknown[] = [];
    // Requests share the current scope, so a prior test's client would linger here.
    if (!env.SENTRY_DSN) getCurrentScope().setClient(undefined);
    const recorded = recordingConfig(config, sent);
    const handler = withSentry(throwingApp(recorded), recorded);

    return {
      invoke: async (request) => {
        const ctx = createExecutionContext();
        latest = ctx;
        const fetch = handler.fetch;
        if (!fetch) throw new Error("withSentry returned no fetch handler");
        return fetch(request as never, env, ctx);
      },
      sent,
    };
  },
  // Sentry sends through waitUntil; this is what makes the send observable.
  settle: async () => {
    if (latest) await waitOnExecutionContext(latest);
  },
};
