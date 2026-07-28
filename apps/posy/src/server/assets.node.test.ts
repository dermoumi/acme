import { describe, expect, it } from "vitest";
import { staticAssets } from "./assets.node";

const assets = staticAssets("./test/fixtures/assets");

async function get(path: string): Promise<Response> {
  return assets.fetch(new Request(`http://assets.test${path}`));
}

describe("staticAssets", () => {
  it("serves a file that exists", async () => {
    const response = await get("/asset.txt");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("fixture asset");
  });

  it("serves the shell for a path with no file", async () => {
    const response = await get("/deep/unknown/route");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("posy fixture");
  });
});
