import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { assets } from "./assets.workerd";
import type { AssetsBindings } from "./contract";

const app = new Hono<{ Bindings: AssetsBindings }>();
app.all("*", assets.createHandler({}));

const get = async (path: string) => {
  return app.fetch(new Request(`http://assets.test${path}`), env);
};

describe("the assets a worker serves", () => {
  it("serves a file the platform has", async () => {
    const response = await get("/asset.txt");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("fixture asset");
  });

  // The binding's own not_found_handling, which this arm never second-guesses.
  it("serves the shell for a path with no file", async () => {
    const response = await get("/deep/unknown/route");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("fixture shell");
  });

  // What middleware wrapping this kit has to know: posy's gate rewraps the
  // response before stamping a header, and this is why.
  it("answers with headers a caller cannot set", async () => {
    const response = await get("/asset.txt");

    expect(() => {
      response.headers.set("X-Robots-Tag", "noindex");
    }).toThrow(TypeError);
  });
});
