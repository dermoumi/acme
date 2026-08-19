import { defineConfig } from "@acme/app";
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

const ask = async (handler: Handler) => {
  const request = new Request("http://app.test/who");
  const response = await handler.fetch(request, {});

  return response.text();
};

const routed = (app: Hono) => {
  app.get("/who", (ctx) => ctx.text("routed"));
};

describe("serve", () => {
  it("serves the routes the setup added", async () => {
    const config = defineConfig({});
    await expect(ask(serve(routed, config))).resolves.toBe("routed");
  });

  it("serves what the setup returned instead of the app it was given", async () => {
    const wrapped = new Hono().get("/who", (ctx) => ctx.text("wrapped"));
    const config = defineConfig({});
    const handler = serve((app) => {
      routed(app);

      return wrapped;
    }, config);

    await expect(ask(handler)).resolves.toBe("wrapped");
  });

  it("takes the app's own config when none is passed", async () => {
    await expect(ask(serve(routed))).resolves.toBe("routed");
  });
});
