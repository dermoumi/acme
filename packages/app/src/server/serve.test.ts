import { defineConfig, type Kit } from "@acme/app";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Handler } from "./contract";
import { kitVars, serve } from "./serve";

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

// What the kit's own package would declare, so a route reads ctx.var.greeting
// with nothing to import.
declare module "hono" {
  interface ContextVariableMap {
    greeting: string;
  }
}

const greeter: Kit = {
  name: "greeter",
  vars: (env) => {
    return { greeting: (env as { GREETING?: string }).GREETING ?? "none" };
  },
};

const ask = async (handler: Handler, env: unknown = {}) => {
  const response = await handler.fetch(new Request("http://app.test/who"), env);

  return response.text();
};

const routed = (app: Hono) => {
  app.get("/who", (ctx) => {
    return ctx.text("routed");
  });
};

describe("serve", () => {
  it("serves the routes the setup added", async () => {
    await expect(ask(serve(routed, defineConfig({})))).resolves.toBe("routed");
  });

  it("serves what the setup returned instead of the app it was given", async () => {
    const wrapped = new Hono().get("/who", (ctx) => {
      return ctx.text("wrapped");
    });
    const handler = serve((app) => {
      routed(app);

      return wrapped;
    }, defineConfig({}));

    await expect(ask(handler)).resolves.toBe("wrapped");
  });

  it("takes the app's own config when none is passed", async () => {
    await expect(ask(serve(routed))).resolves.toBe("routed");
  });
});

describe("kitVars", () => {
  it("puts every declared kit's variables on the request", async () => {
    const app = new Hono();
    app.use(kitVars(defineConfig({ kits: [greeter] })));
    app.get("/who", (ctx) => {
      return ctx.text(ctx.var.greeting);
    });

    await expect(ask(app, { GREETING: "hei" })).resolves.toBe("hei");
  });

  it("leaves a kit declaring no variables alone", async () => {
    const app = new Hono();
    app.use(kitVars(defineConfig({ kits: [{ name: "quiet" }] })));
    routed(app);

    await expect(ask(app)).resolves.toBe("routed");
  });
});
