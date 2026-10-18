import type { ExecutionContext } from "@cloudflare/workers-types";
import { type Client, getCurrentScope } from "@sentry/core";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import type { Bench } from "./contract";
import { recordingConfig, wireApp } from "./wired-app";

let latest: ExecutionContext | undefined;

// Sentry keeps one client per isolate and exports no way to reset it.
const CACHED_CLIENT = "__SENTRY_CLOUDFLARE_CLIENT__";

export const bench: Bench = {
  build: (env, config, wire = wireApp) => {
    const sent: unknown[] = [];
    // Requests share the current scope, so a prior test's client would linger.
    if (!env.SENTRY_DSN) getCurrentScope().setClient(undefined);
    // close() marks it stale synchronously, so no await is needed.
    const cached = Reflect.get(globalThis, CACHED_CLIENT) as Client | undefined;
    void cached?.close(0);
    const recorded = recordingConfig(config, sent);
    const handler = wire(recorded);

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
