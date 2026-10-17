import type { AssetsFallback } from "@acme/assets";
import type { KitShared } from "@acme/app";
import { createErrorHandler, createKitRegistry } from "@acme/app/testing";
import { type Context, Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routerKit } from "./kit";

// Stands in for the assets kit, whose catch-all calls what the router hands it.
const initRouter = (reportError?: KitShared["reportError"]) => {
  let fallback: AssetsFallback | undefined;
  const context = createKitRegistry("@acme/router");
  context.register("setAssetsFallback", (next) => {
    fallback = next;
  });
  routerKit().init?.(context);
  // After init, as a reporting kit declared after this one would.
  if (reportError) context.register("reportError", reportError);

  const answer = async (ctx: Context) => {
    return fallback?.(ctx) ?? ctx.notFound();
  };

  return { context, answer };
};

const buildApp = (viewer?: string, reportError?: KitShared["reportError"]) => {
  const { answer } = initRouter(reportError);
  const app = new Hono<{ Variables: { viewer: string } }>();
  app.use(async (ctx, next) => {
    if (viewer) ctx.set("viewer", viewer);
    await next();
  });
  app.all("*", answer);

  return app;
};

// A form post that throws, answered through onError as composeApp would.
const buildErrorPageApp = (reportError?: KitShared["reportError"]) => {
  const { context, answer } = initRouter(reportError);
  const app = new Hono();
  app.post("/broken", () => {
    throw new Error("form post exploded");
  });
  const findPage = () => {
    return context.require("renderErrorPage");
  };
  const handleError = createErrorHandler({ findPage });
  app.onError(handleError);
  app.all("*", answer);

  return app;
};

const postFromBrowser = (app: Hono, path: string) => {
  const headers = { accept: "text/html", "content-type": "text/plain" };

  return app.request(path, { method: "POST", headers, body: "posted" });
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

  // The fixture's loader throws at /broken, so a loader run would fail instead.
  it("renders the root route's boundary as the error page, running no loader", async () => {
    const app = buildErrorPageApp();
    const response = await postFromBrowser(app, "/broken");

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe(
      "rendered /broken for nobody failing 500 {}",
    );
  });

  it("hands the error page the reference it was given", async () => {
    const { context } = initRouter();
    const app = new Hono();
    app.get("/page", async (ctx) => {
      const renderErrorPage = context.require("renderErrorPage");
      return renderErrorPage(ctx, { status: 500, reference: "abc123" });
    });
    const response = await app.request("/page");

    await expect(response.text()).resolves.toBe(
      'rendered /page for nobody failing 500 {"reference":"abc123"}',
    );
  });

  it("renders the boundary with the status it is asked for", async () => {
    const { context } = initRouter();
    const app = new Hono();
    app.get("/page", async (ctx) => {
      const renderErrorPage = context.require("renderErrorPage");
      return renderErrorPage(ctx, { status: 404 });
    });
    const response = await app.request("/page");

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe(
      "rendered /page for nobody failing 404 {}",
    );
  });

  it("leaves the error page's own failure unreported", async () => {
    const reported: unknown[] = [];
    const app = buildErrorPageApp((_ctx, error) => {
      reported.push(error);
    });
    await postFromBrowser(app, "/broken");

    expect(reported).toEqual([]);
  });

  it("reports a boundary that fails while rendering the error page", async () => {
    const reported: unknown[] = [];
    const { context } = initRouter((_ctx, error) => {
      reported.push(error);
    });
    const app = new Hono();
    app.get("/bad-boundary", async (ctx) => {
      const renderErrorPage = context.require("renderErrorPage");
      return renderErrorPage(ctx, { status: 500 });
    });
    await app.request("/bad-boundary");

    expect(reported).toContainEqual(new Error("boundary exploded"));
  });

  it("fails to compose without the assets kit it renders behind", () => {
    const context = createKitRegistry("@acme/router");

    expect(() => routerKit().init?.(context)).toThrow(/setAssetsFallback/u);
  });
});
