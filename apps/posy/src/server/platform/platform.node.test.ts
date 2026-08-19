import type { Context } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../bindings";
import { platform } from "./platform.node";

// Only env is read, and building a whole Context to prove that would say less.
const withEnv = (env: Record<string, unknown>) => {
  return { env } as unknown as Context<AppEnv>;
};

describe("the assets a node process serves", () => {
  it("takes a fetcher something bound, so a test can serve fixtures", () => {
    const bound = { fetch: () => Promise.resolve(new Response("bound")) };

    expect(platform.assets(withEnv({ ASSETS: bound }))).toBe(bound);
  });

  // ctx.env is process.env here, so ASSETS is as likely to be a stray string
  // as a binding. Taking it on truthiness 500s every asset and SPA route while
  // /health stays green, which no probe would catch.
  it("ignores an ASSETS that is not one, and serves files anyway", async () => {
    const assets = platform.assets(withEnv({ ASSETS: "anything" }));

    expect(assets).toHaveProperty("fetch");
    await expect(
      assets.fetch(new Request("http://posy.test/")),
    ).resolves.toBeInstanceOf(Response);
  });
});
