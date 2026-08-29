import { composeApp, createKitContext } from "@acme/app/testing";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { healthKit } from "./kit";

const IDENTITY = {
  APP_NAME: "shop",
  APP_VERSION: "1.2.3",
  APP_REVISION: "abc1234",
};

// The fixture config declares this kit and one contributor behind it.
const ask = async (path: string, env: object = IDENTITY) => {
  const response = await composeApp(new Hono()).request(path, {}, env);

  return response.json();
};

describe("healthKit", () => {
  it("names itself by its specifier, so a reader can find it back", () => {
    expect(healthKit()).toMatchObject({ name: "@acme/health" });
  });

  it("answers the verdict alone, for whatever probes it periodically", async () => {
    await expect(ask("/health")).resolves.toEqual({
      status: "ok",
      release: "shop@1.2.3+abc1234",
      verdict: "up",
      thrower: "error",
    });
  });

  it("answers the breakdown as well once asked for the full body", async () => {
    await expect(ask("/health?full")).resolves.toMatchObject({
      verdict: "up",
      detail: "why",
    });
  });

  it("keeps answering when a contributor throws, since it is still serving", async () => {
    await expect(ask("/health")).resolves.toMatchObject({
      status: "ok",
      thrower: "error",
    });
  });

  it("reports the build as dev until a deployment stamps one", async () => {
    await expect(ask("/health", { APP_NAME: "shop" })).resolves.toMatchObject({
      release: "shop@dev+dev",
    });
  });

  it("answers where the app said, for an app that serves it elsewhere", async () => {
    // By hand, on its own context: a second app is what no process has.
    const app = new Hono();
    const context = createKitContext("@acme/health");
    healthKit({ path: "/-/live" }).init?.(context).routes?.(app);

    const response = await app.request("/-/live", {}, IDENTITY);

    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });
});
