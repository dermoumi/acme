import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { assetsKit } from "./kit";

// Both arms prefer a bound fetcher: the binding on workerd, whatever a test
// bound on node. It is what lets one suite cover the kit on either runtime.
const bound = {
  fetch: (request: Request) => {
    const { pathname } = new URL(request.url);

    return Promise.resolve(new Response(`asset ${pathname}`));
  },
};

const buildApp = () => {
  const app = new Hono();
  app.get("/health", (ctx) => ctx.text("routed"));
  assetsKit().init?.().routes?.(app);

  return app;
};

const ask = async (path: string, method = "GET") => {
  const request = new Request(`http://app.test${path}`, { method });
  const response = await buildApp().fetch(request, { ASSETS: bound });

  return response.text();
};

describe("assetsKit", () => {
  it("names itself by its specifier, so a reader can find it back", () => {
    expect(assetsKit()).toMatchObject({ name: "@acme/assets" });
  });

  it("serves a path the app left unclaimed from its static files", async () => {
    await expect(ask("/some/page")).resolves.toBe("asset /some/page");
  });

  it("leaves the routes the app already claimed alone", async () => {
    await expect(ask("/health")).resolves.toBe("routed");
  });

  // A GET-only catch-all would answer an unclaimed POST with a 404 the app
  // never wrote, where the assets binding has its own answer for one.
  it("serves whatever method a request arrives with", async () => {
    await expect(ask("/some/page", "POST")).resolves.toBe("asset /some/page");
  });
});
