import { defineConfig, type Kit, type KitShutdown } from "@acme/app";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Handler } from "./contract";
import {
  composeApp,
  serve,
  setupKitRoutes,
  shutdownKits,
  wrapWithKits,
} from "./serve";

const given = vi.hoisted(() => {
  return { shutdown: undefined as KitShutdown | undefined };
});

// On node serving binds a port; standing in for it lets one suite cover both.
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

// What the kit's own package would declare, so a route can read ctx.var.
declare module "hono" {
  interface ContextVariableMap {
    greeting: string;
  }
}

const greeter: Kit = {
  name: "@fixture/greeter",
  init: () => ({ vars: () => ({ greeting: "hei" }) }),
};

// A catch-all: mounted first it would answer everything the app registers.
const answeringKit = (body: string): Kit => {
  return {
    name: `@fixture/${body}`,
    init: () => ({
      routes: (app) => {
        app.all("*", (ctx) => ctx.text(body));
      },
    }),
  };
};

// Each wrapper stamps what it saw, so the answer spells out the order.
const stampingKit = (mark: string): Kit => {
  return {
    name: `@fixture/${mark}`,
    init: () => ({
      handler: (served) => {
        return {
          fetch: async (request, env, ctx) => {
            const answer = await served.fetch(request, env, ctx);

            return new Response(`${mark}(${await answer.text()})`);
          },
        };
      },
    }),
  };
};

const closingKit = (name: string, closed: string[]): Kit => {
  return {
    name: `@fixture/${name}`,
    init: () => ({
      shutdown: async () => {
        await Promise.resolve();
        closed.push(name);
      },
    }),
  };
};

const buildApp = () => {
  return new Hono().get("/who", (ctx) => ctx.text("routed"));
};

const addRoutes = (app: Hono) => {
  app.get("/who", (ctx) => ctx.text("routed"));
};

describe("serve", () => {
  it("serves the routes the app added", async () => {
    const app = buildApp();
    const config = defineConfig({});

    await expect(ask(serve(app, config))).resolves.toBe("routed");
  });

  it("serves the app inside whatever a kit wraps it in", async () => {
    const app = buildApp();
    const config = defineConfig({ kits: [stampingKit("wrapped")] });

    await expect(ask(serve(app, config))).resolves.toBe("wrapped(routed)");
  });

  it("takes the app's own config when none is passed", async () => {
    const app = buildApp();

    await expect(ask(serve(app))).resolves.toBe("routed");
  });

  it("hands the host what shuts the declared kits down", async () => {
    const closed: string[] = [];
    const config = defineConfig({ kits: [closingKit("closed", closed)] });

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

describe("composeApp", () => {
  it("puts a kit's variables where the app's own routes read them", async () => {
    const app = new Hono().get("/who", (ctx) => ctx.text(ctx.var.greeting));
    const config = defineConfig({ kits: [greeter] });

    await expect(ask(composeApp(app, config))).resolves.toBe("hei");
  });

  it("adds a kit's routes behind the app's own", async () => {
    const app = buildApp();
    const config = defineConfig({ kits: [answeringKit("kit")] });

    await expect(ask(composeApp(app, config))).resolves.toBe("routed");
  });

  it("answers a path the app left unclaimed from a kit's routes", async () => {
    const app = buildApp();
    const config = defineConfig({ kits: [answeringKit("kit")] });

    await expect(ask(composeApp(app, config), "/nothing")).resolves.toBe("kit");
  });
});

describe("setupKitRoutes", () => {
  it("adds a declared kit's routes to the app", async () => {
    const app = new Hono();
    const config = defineConfig({ kits: [answeringKit("kit")] });
    setupKitRoutes(app, config);

    await expect(ask(app)).resolves.toBe("kit");
  });

  it("leaves the routes the app already claimed alone", async () => {
    const app = new Hono();
    const config = defineConfig({ kits: [answeringKit("kit")] });
    addRoutes(app);
    setupKitRoutes(app, config);

    await expect(ask(app)).resolves.toBe("routed");
  });

  it("asks kits in the order the config lists them", async () => {
    const app = new Hono();
    const config = defineConfig({
      kits: [answeringKit("first"), answeringKit("second")],
    });
    setupKitRoutes(app, config);

    await expect(ask(app)).resolves.toBe("first");
  });

  it("leaves a kit contributing no routes alone", async () => {
    const app = new Hono();
    const config = defineConfig({ kits: [{ name: "@fixture/quiet" }] });
    addRoutes(app);
    setupKitRoutes(app, config);

    await expect(ask(app)).resolves.toBe("routed");
  });

  it("takes the app's own config when none is passed", async () => {
    const app = new Hono();
    addRoutes(app);
    setupKitRoutes(app);

    await expect(ask(app)).resolves.toBe("routed");
  });
});

describe("wrapWithKits", () => {
  it("puts a declared kit's wrapper around the handler", async () => {
    const app = buildApp();
    const config = defineConfig({ kits: [stampingKit("kit")] });

    await expect(ask(wrapWithKits(app, config))).resolves.toBe("kit(routed)");
  });

  // Outermost first: a kit establishing something has it in place for the rest.
  it("wraps in config order, leaving the first kit outermost", async () => {
    const app = buildApp();
    const config = defineConfig({
      kits: [stampingKit("first"), stampingKit("second")],
    });

    await expect(ask(wrapWithKits(app, config))).resolves.toBe(
      "first(second(routed))",
    );
  });

  it("leaves a kit wrapping nothing alone", async () => {
    const app = buildApp();
    const config = defineConfig({ kits: [{ name: "@fixture/quiet" }] });

    await expect(ask(wrapWithKits(app, config))).resolves.toBe("routed");
  });

  it("takes the app's own config when none is passed", async () => {
    const app = buildApp();

    await expect(ask(wrapWithKits(app))).resolves.toBe("routed");
  });
});

describe("shutdownKits", () => {
  it("runs every declared kit's shutdown", async () => {
    const closed: string[] = [];
    const config = defineConfig({
      kits: [closingKit("first", closed), closingKit("second", closed)],
    });

    await shutdownKits(config);

    expect(closed.toSorted()).toEqual(["first", "second"]);
  });

  // The host leaves as soon as this answers, so an unfinished hook is lost.
  it("answers only once every hook has finished", async () => {
    const closed: string[] = [];
    const config = defineConfig({ kits: [closingKit("slow", closed)] });

    const pending = shutdownKits(config);
    expect(closed).toEqual([]);
    await pending;

    expect(closed).toEqual(["slow"]);
  });

  it("leaves a kit shutting nothing down alone", async () => {
    const config = defineConfig({ kits: [{ name: "@fixture/quiet" }] });

    await expect(shutdownKits(config)).resolves.toBeUndefined();
  });

  it("takes the app's own config when none is passed", async () => {
    await expect(shutdownKits()).resolves.toBeUndefined();
  });
});
