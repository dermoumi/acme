import { defineConfig, type Kit, type KitShutdown } from "@acme/app";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Handler } from "./contract";
import { serve } from "./serve";

const given = vi.hoisted(() => {
  return { shutdown: undefined as KitShutdown | undefined };
});

// Serving is the only thing a host does differently, and on node it binds a
// port; standing in for it is what lets one suite cover both runtimes.
vi.mock("#host", () => {
  return {
    host: {
      serve: (handler: Handler, shutdown: KitShutdown) => {
        given.shutdown = shutdown;

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

// A catch-all, the shape the ordering has to hold for.
const catchAll: Kit = {
  name: "@fixture/catch-all",
  init: () => ({
    routes: (app) => {
      app.all("*", (ctx) => ctx.text("kit"));
    },
  }),
};

const wrappingKit: Kit = {
  name: "@fixture/wrapping",
  init: () => ({
    handler: (served) => {
      return {
        fetch: async (request, env, ctx) => {
          const answer = await served.fetch(request, env, ctx);

          return new Response(`wrapped(${await answer.text()})`);
        },
      };
    },
  }),
};

const buildApp = () => {
  return new Hono().get("/who", (ctx) => ctx.text("routed"));
};

describe("serve", () => {
  it("serves the routes the app added", async () => {
    const app = buildApp();
    const config = defineConfig({});

    await expect(ask(serve(app, config))).resolves.toBe("routed");
  });

  it("serves the app inside whatever a kit wraps it in", async () => {
    const app = buildApp();
    const config = defineConfig({ kits: [wrappingKit] });

    await expect(ask(serve(app, config))).resolves.toBe("wrapped(routed)");
  });

  it("takes the app's own config when none is passed", async () => {
    const app = buildApp();

    await expect(ask(serve(app))).resolves.toBe("routed");
  });

  it("serves a path the app left unclaimed from a kit's routes", async () => {
    const app = buildApp();
    const config = defineConfig({ kits: [catchAll] });

    await expect(ask(serve(app, config), "/nothing")).resolves.toBe("kit");
  });

  it("adds a kit's routes behind the ones the app added", async () => {
    const app = buildApp();
    const config = defineConfig({ kits: [catchAll] });

    await expect(ask(serve(app, config))).resolves.toBe("routed");
  });

  it("hands the host what shuts the declared kits down", async () => {
    const closed: string[] = [];
    const closingKit: Kit = {
      name: "@fixture/closing",
      init: () => ({
        shutdown: () => {
          closed.push("closed");
        },
      }),
    };
    const config = defineConfig({ kits: [closingKit] });

    serve(buildApp(), config);
    await given.shutdown?.();

    expect(closed).toEqual(["closed"]);
  });

  // Both slots read one state, so filling both must not build the kit twice.
  it("builds each declared kit once, however many slots read it", () => {
    const once: Kit = { name: "@fixture/once", init: vi.fn(() => ({})) };
    const config = defineConfig({ kits: [once] });

    serve(buildApp(), config);

    expect(once.init).toHaveBeenCalledOnce();
  });
});
