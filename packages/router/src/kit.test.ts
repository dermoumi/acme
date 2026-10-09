import type { AssetsFallback } from "@acme/assets";
import { createKitRegistry } from "@acme/app/testing";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { routerKit } from "./kit";

// Stands in for the assets kit, whose catch-all calls what the router hands it.
const buildApp = () => {
  let fallback: AssetsFallback | undefined;
  const context = createKitRegistry("@acme/router");
  context.register("setAssetsFallback", (next) => {
    fallback = next;
  });
  routerKit().init?.(context);

  const app = new Hono();
  app.all("*", async (ctx) => fallback?.(ctx) ?? ctx.notFound());

  return app;
};

describe("routerKit", () => {
  it("names itself by its specifier, so a reader can find it back", () => {
    expect(routerKit()).toMatchObject({ name: "@acme/router" });
  });

  it("renders a path no file answers with the router's build", async () => {
    const response = await buildApp().request("/some/page");

    await expect(response.text()).resolves.toBe("rendered /some/page");
  });

  it("fails to compose without the assets kit it renders behind", () => {
    const context = createKitRegistry("@acme/router");

    expect(() => routerKit().init?.(context)).toThrow(/setAssetsFallback/u);
  });
});
