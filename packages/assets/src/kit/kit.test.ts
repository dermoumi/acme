import { createBindings } from "#testing/runtime";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { assetsKit } from "./kit";

// One directory for both runtimes: the node arm is pointed at it by config,
// and the workerd project's miniflare binding serves the same files.
const FIXTURES = "./test/fixtures/assets";

const buildApp = () => {
  const app = new Hono();
  app.get("/health", (ctx) => ctx.text("routed"));
  assetsKit({ root: FIXTURES }).init?.().routes?.(app);

  return app;
};

const ask = async (path: string) => {
  const request = new Request(`http://app.test${path}`);
  const response = await buildApp().fetch(request, createBindings());

  return response.text();
};

describe("assetsKit", () => {
  it("names itself by its specifier, so a reader can find it back", () => {
    expect(assetsKit()).toMatchObject({ name: "@acme/assets" });
  });

  it("carries what the app declared, for whoever reads it back", () => {
    expect(assetsKit({ root: FIXTURES }).config).toEqual({ root: FIXTURES });
  });

  it("serves a path the app left unclaimed from its static files", async () => {
    await expect(ask("/asset.txt")).resolves.toContain("fixture asset");
  });

  it("serves the shell for a path with no file behind it", async () => {
    await expect(ask("/some/page")).resolves.toContain("fixture shell");
  });

  it("leaves the routes the app already claimed alone", async () => {
    await expect(ask("/health")).resolves.toBe("routed");
  });
});
