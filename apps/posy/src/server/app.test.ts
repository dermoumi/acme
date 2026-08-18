import { resetDb } from "@acme/db/testing";
import { createBindings } from "#testing/runtime";
import { beforeEach, describe, expect, it } from "vitest";
import { migratedEnv } from "./auth/test-utils";
import { createApp } from "./app";
import { getDb } from "./db";

describe("/health", () => {
  const app = createApp();
  // These cases deliberately run with and without a database.
  beforeEach(() => resetDb(getDb));

  it("reports the build and what it is wired to", async () => {
    const res = await app.request("/health", {}, createBindings());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      app: "posy",
      version: "dev",
      revision: "dev",
      sentry: "off",
      rateLimit: "on",
      database: "down",
    });
  });

  it("reports the build a deploy check waits for", async () => {
    const res = await app.request(
      "/health",
      {},
      { ...createBindings(), APP_VERSION: "1.2.3", APP_REVISION: "abc1234" },
    );

    expect(await res.json()).toMatchObject({
      version: "1.2.3",
      revision: "abc1234",
    });
  });

  it("reports sentry as configured once a DSN is bound", async () => {
    const res = await app.request(
      "/health",
      {},
      {
        ...createBindings(),
        SENTRY_DSN: "https://dummy@dummy.ingest.sentry.io/1",
      },
    );

    expect(await res.json()).toMatchObject({ sentry: "configured" });
  });

  it("reports the database as ok once it can be queried", async () => {
    const res = await app.request("/health", {}, await migratedEnv());

    expect(await res.json()).toMatchObject({ database: "ok" });
  });
});
