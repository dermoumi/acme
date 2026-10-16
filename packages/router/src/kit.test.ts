import type { AssetsFallback } from "@acme/assets";
import type { KitShared } from "@acme/app";
import { createKitRegistry } from "@acme/app/testing";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routerKit } from "./kit";

// Stands in for the assets kit, whose catch-all calls what the router hands it.
const buildApp = (viewer?: string, reportError?: KitShared["reportError"]) => {
  let fallback: AssetsFallback | undefined;
  const context = createKitRegistry("@acme/router");
  context.register("setAssetsFallback", (next) => {
    fallback = next;
  });
  routerKit().init?.(context);
  // After init, as a reporting kit declared after this one would.
  if (reportError) context.register("reportError", reportError);

  const app = new Hono<{ Variables: { viewer: string } }>();
  app.use(async (ctx, next) => {
    if (viewer) ctx.set("viewer", viewer);
    await next();
  });
  app.all("*", async (ctx) => fallback?.(ctx) ?? ctx.notFound());

  return app;
};

const buildReportingApp = () => {
  const reported: unknown[] = [];
  const app = buildApp(undefined, (_ctx, error) => {
    reported.push(error);
  });

  return { app, reported };
};

describe("routerKit", () => {
  // The router logs each failure it answers.
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("names itself by its specifier, so a reader can find it back", () => {
    expect(routerKit()).toMatchObject({ name: "@acme/router" });
  });

  it("renders a path no file answers with the router's build", async () => {
    const response = await buildApp().request("/some/page");

    await expect(response.text()).resolves.toBe(
      "rendered /some/page for nobody",
    );
  });

  it("hands loaders and actions the request's Hono context", async () => {
    const response = await buildApp("tester").request("/some/page");

    await expect(response.text()).resolves.toBe(
      "rendered /some/page for tester",
    );
  });

  it("hands a loader's error to the kit that reports errors", async () => {
    const { app, reported } = buildReportingApp();
    const response = await app.request("/broken");

    expect(response.status).toBe(500);
    expect(reported).toEqual([new Error("loader exploded")]);
  });

  it("leaves an expected error response unreported", async () => {
    const { app, reported } = buildReportingApp();
    const response = await app.request("/missing");

    expect(response.status).toBe(404);
    expect(reported).toEqual([]);
  });

  it("still answers a loader's error where no kit reports errors", async () => {
    const response = await buildApp().request("/broken");

    expect(response.status).toBe(500);
  });

  it("fails to compose without the assets kit it renders behind", () => {
    const context = createKitRegistry("@acme/router");

    expect(() => routerKit().init?.(context)).toThrow(/setAssetsFallback/u);
  });
});
