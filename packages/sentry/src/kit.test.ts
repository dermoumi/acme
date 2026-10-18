import type { HealthStatus } from "@acme/health";
import { stubHealthKit } from "@acme/health/testing";
import type { Context } from "hono";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { SentryConfig } from "./server/config";
import { DSN } from "./server/testing/contract";
import { sentryKit } from "./kit";

function buildApp(): Hono {
  const app = new Hono();
  sentryKit().init?.(stubHealthKit("@acme/sentry").context).routes?.(app);

  return app;
}

// What the kit hands the health kit while it initialises.
function getHealthStatus(config: SentryConfig = {}): HealthStatus {
  const health = stubHealthKit("@acme/sentry");
  sentryKit(config).init?.(health.context);

  return health.status("sentry");
}

// The status reads only the env, which is what a host hands the context.
const buildContext = (env: unknown) => {
  return { env } as Context;
};

describe("sentryKit", () => {
  it("names itself by its specifier, so a reader can find it back", () => {
    expect(sentryKit()).toMatchObject({ name: "@acme/sentry" });
  });

  it("carries what the app declared, for whoever reads it back", () => {
    expect(sentryKit({ redactKeys: ["note"] }).config).toEqual({
      redactKeys: ["note"],
    });
  });

  // The 403 is the tunnel's cross-origin guard, so only it answers there.
  it("answers the path the browser posts its events to", async () => {
    const app = buildApp();
    const env = { SENTRY_DSN: DSN };

    const res = await app.request("/sentry", { method: "POST" }, env);

    expect(res.status).toBe(403);
  });

  it("registers what onError reports through", () => {
    const { context } = stubHealthKit("@acme/sentry");
    sentryKit().init?.(context);

    expect(context.require("captureError")).toBeTypeOf("function");
  });

  it("reports itself off where no DSN reached the app", () => {
    expect(getHealthStatus()(buildContext({}))).toBe("off");
  });

  it("reports itself configured once a DSN is bound", () => {
    expect(getHealthStatus()(buildContext({ SENTRY_DSN: DSN }))).toBe(
      "configured",
    );
  });

  // The app renamed it, so a status reading SENTRY_DSN would say "off" while
  // every event still reports.
  it("reports through the name the app gave the DSN", () => {
    const config = {
      settings: (env: Record<string, string | undefined>) => {
        return { dsn: env.REPORTING_DSN };
      },
    };

    expect(getHealthStatus(config)(buildContext({ REPORTING_DSN: DSN }))).toBe(
      "configured",
    );
  });
});
