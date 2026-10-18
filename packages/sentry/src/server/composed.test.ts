import { bench } from "#testing/bench";
import { defineConfig } from "@acme/app";
import { composeApp, wrapWithKits } from "@acme/app/testing";
import { healthKit } from "@acme/health";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { sentryKit } from "../kit";
import type { SentryConfig } from "./config";
import { DSN } from "./testing/contract";

// composeApp registers into the module-level registry, so one build per file.
function composeSentryApp(sentry: SentryConfig) {
  const config = defineConfig({ kits: [healthKit(), sentryKit(sentry)] });
  const app = new Hono();
  app.get("/boom", () => {
    throw new Error("route exploded");
  });

  const composed = composeApp(app, config);

  return wrapWithKits(composed, config);
}

describe("sentryKit through composeApp", () => {
  it("answers a thrown route with a quotable reference", async () => {
    const { invoke } = bench.build({ SENTRY_DSN: DSN }, {}, composeSentryApp);
    const request = new Request("https://posy.test/boom", {
      headers: { Accept: "application/json" },
    });
    const res = await invoke(request);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { reference: string | null };
    expect(body.reference).toMatch(/^[a-f0-9]{32}$/u);
  });
});
