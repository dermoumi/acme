import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { assets } from "./assets.node";
import type { AssetsBindings } from "./contract";

// Read on the first request the filesystem answers, and held from there.
process.env.ASSETS_DIR = "./test/fixtures/assets";

const app = new Hono<{ Bindings: AssetsBindings }>();
app.all("*", assets.handler);

const get = async (path: string, env: Record<string, unknown> = {}) => {
  return app.fetch(new Request(`http://assets.test${path}`), env);
};

describe("the assets a node process serves", () => {
  it("serves a file that exists", async () => {
    const response = await get("/asset.txt");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("fixture asset");
  });

  it("serves the shell for a path with no file", async () => {
    const response = await get("/deep/unknown/route");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("fixture shell");
  });

  it("takes a fetcher something bound, so a test can serve fixtures", async () => {
    const bound = { fetch: () => Promise.resolve(new Response("bound")) };
    // A path the filesystem would answer too, so the body says which one did.
    const response = await get("/asset.txt", { ASSETS: bound });

    await expect(response.text()).resolves.toBe("bound");
  });

  // ctx.env is process.env here, so a stray ASSETS taken on truthiness 500s
  // every asset and SPA route while /health stays 200, which no probe catches.
  it("ignores an ASSETS that is not one, and serves files anyway", async () => {
    const response = await get("/asset.txt", { ASSETS: "anything" });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("fixture asset");
  });
});
