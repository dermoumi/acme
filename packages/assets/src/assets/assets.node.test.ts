import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { assets } from "./assets.node";
import type { AssetsBindings, AssetsConfig } from "./contract";

const FIXTURES = "./test/fixtures/assets";

const get = async (path: string, config: AssetsConfig = {}) => {
  const app = new Hono<{ Bindings: AssetsBindings }>();
  app.all("*", assets.createHandler(config));

  return app.fetch(new Request(`http://assets.test${path}`));
};

describe("the assets a node process serves", () => {
  afterEach(() => {
    delete process.env.ASSETS_ROOT;
  });

  it("serves a file from the directory it was given", async () => {
    const response = await get("/asset.txt", { root: FIXTURES });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("fixture asset");
  });

  // A page that does not exist is a 404, whatever the client router renders on
  // it. Workers answer 200 there; this arm does not copy that.
  it("answers 404 with the shell for a path with no file", async () => {
    const response = await get("/deep/unknown/route", { root: FIXTURES });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("fixture shell");
  });

  it("answers 404 with the shell for a missing asset too", async () => {
    const response = await get("/assets/gone.js", { root: FIXTURES });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("fixture shell");
  });

  it("takes the directory ASSETS_ROOT names when the app declared none", async () => {
    process.env.ASSETS_ROOT = FIXTURES;
    const response = await get("/asset.txt");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("fixture asset");
  });

  // The deployment sets the env var; an app naming a directory has said where
  // its build lands, which is not a thing a host overrides.
  it("prefers what the app declared over ASSETS_ROOT", async () => {
    process.env.ASSETS_ROOT = "./test/fixtures/nowhere";
    const response = await get("/asset.txt", { root: FIXTURES });

    await expect(response.text()).resolves.toContain("fixture asset");
  });
});
