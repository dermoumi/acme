import { assetsEnv } from "#testing/assets";
import { describe, expect, it } from "vitest";
import { resolveAssets } from "./index";

// The point of the node arm is that it answers like the platform binding, so
// both runtimes are held to this one suite.
const assets = resolveAssets(assetsEnv);

async function get(path: string): Promise<Response> {
  return assets.fetch(new Request(`http://assets.test${path}`));
}

describe("resolveAssets", () => {
  it("serves a file that exists", async () => {
    const response = await get("/asset.txt");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("fixture asset");
  });

  it("serves the shell for a path with no file", async () => {
    const response = await get("/deep/unknown/route");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("app fixture");
  });
});
