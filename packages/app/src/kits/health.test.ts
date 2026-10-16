import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { defineConfig, type Kit, orderKits } from "../internal/config";
import { composeApp } from "../server/serve";
import { healthKit } from "./health";

const IDENTITY = {
  APP_NAME: "shop",
  APP_VERSION: "1.2.3",
  APP_REVISION: "abc1234",
};

// Ahead of the health kit it requires: the sort is what puts these in order.
const contributor: Kit = {
  name: "@fixture/contributor",
  requires: ["@acme/health"],
  init: ({ require }) => {
    const addHealthStatus = require("addHealthStatus");
    addHealthStatus("verdict", () => "up");
    addHealthStatus("detail", () => "why", { optional: true });
    addHealthStatus("thrower", () => {
      throw new Error("this contributor is broken");
    });

    return {};
  },
};

const appConfig = defineConfig({ kits: [contributor, healthKit()] });

const ask = async (path: string, env: object = IDENTITY) => {
  const app = composeApp(new Hono(), appConfig);
  const response = await app.request(path, {}, env);

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
});

describe("the kits this app declares", () => {
  it("sorts this kit ahead of the one requiring it", () => {
    const ordered = orderKits(appConfig.kits ?? []);

    expect(ordered.map((kit) => kit.name)).toEqual([
      "@acme/health",
      "@fixture/contributor",
    ]);
  });
});
