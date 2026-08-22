import { defineConfig, type Kit } from "@acme/app";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Handler } from "./contract";
import { serve } from "./serve";

// Serving is the only thing a host does differently, and on node it binds a
// port; standing in for it is what lets one suite cover both runtimes.
vi.mock("#host", () => {
  return {
    host: {
      serve: (handler: Handler) => {
        return handler;
      },
    },
  };
});

const ask = async (handler: Handler, path = "/who") => {
  const request = new Request(`http://app.test${path}`);
  const response = await handler.fetch(request, {});

  return response.text();
};

// The shape the ordering has to hold for: mounted before the setup ran, this
// would answer every route the app was about to register.
const catchAll: Kit = {
  name: "@fixture/catch-all",
  init: () => ({
    routes: (app) => {
      app.all("*", (ctx) => ctx.text("kit"));
    },
  }),
};

const addRoutes = (app: Hono) => {
  app.get("/who", (ctx) => ctx.text("routed"));
};

describe("serve", () => {
  it("serves the routes the setup added", async () => {
    const config = defineConfig({});
    await expect(ask(serve(addRoutes, config))).resolves.toBe("routed");
  });

  it("serves what the setup returned instead of the app it was given", async () => {
    const wrapped = new Hono().get("/who", (ctx) => ctx.text("wrapped"));
    const config = defineConfig({});
    const handler = serve((app) => {
      addRoutes(app);

      return wrapped;
    }, config);

    await expect(ask(handler)).resolves.toBe("wrapped");
  });

  it("takes the app's own config when none is passed", async () => {
    await expect(ask(serve(addRoutes))).resolves.toBe("routed");
  });

  it("serves a path the setup left unclaimed from a kit's routes", async () => {
    const config = defineConfig({ kits: [catchAll] });

    await expect(ask(serve(addRoutes, config), "/nothing")).resolves.toBe(
      "kit",
    );
  });

  // A catch-all is what the first kit to want this slot mounts, and one in
  // front of the setup swallows the app whole.
  it("adds a kit's routes behind the ones the setup added", async () => {
    const config = defineConfig({ kits: [catchAll] });

    await expect(ask(serve(addRoutes, config))).resolves.toBe("routed");
  });

  // Both slots read the same state, so a kit that opens something to fill one
  // of them must not open a second.
  it("builds each declared kit once, however many slots read it", () => {
    const once: Kit = { name: "@fixture/once", init: vi.fn(() => ({})) };

    serve(addRoutes, defineConfig({ kits: [once] }));

    expect(once.init).toHaveBeenCalledOnce();
  });
});
