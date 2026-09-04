import { defineConfig, type Kit } from "@acme/app";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { composeApp, setupKitMiddleware } from "./serve";

// Refuses before the route it guards can answer, the way a rate limit does.
const refusingKit = (path: string): Kit => {
  return {
    name: `@fixture/refusing${path}`,
    init: () => ({
      middleware: (app) => {
        app.on("POST", path, (ctx) => ctx.text("refused"));
      },
    }),
  };
};

// Passes the request on, so the marks spell out the order they ran in.
const markingKit = (marks: string[], mark: string): Kit => {
  return {
    name: `@fixture/${mark}`,
    init: () => ({
      middleware: (app) => {
        app.use((_ctx, next) => {
          marks.push(mark);

          return next();
        });
      },
    }),
  };
};

const addRoutes = (app: Hono) => {
  app.get("/who", (ctx) => ctx.text("routed"));
  app.post("/who", (ctx) => ctx.text("routed"));
};

const ask = async (app: Hono, method = "GET", path = "/who") => {
  const request = new Request(`http://app.test${path}`, { method });
  const response = await app.fetch(request, {});

  return response.text();
};

describe("setupKitMiddleware", () => {
  it("mounts a declared kit's middleware on the app", async () => {
    const app = new Hono();
    const config = defineConfig({ kits: [refusingKit("/who")] });
    setupKitMiddleware(app, config);
    addRoutes(app);

    await expect(ask(app, "POST")).resolves.toBe("refused");
  });

  it("asks kits in the order the config lists them", async () => {
    const marks: string[] = [];
    const app = new Hono();
    const config = defineConfig({
      kits: [markingKit(marks, "first"), markingKit(marks, "second")],
    });
    setupKitMiddleware(app, config);
    addRoutes(app);
    await ask(app);

    expect(marks).toEqual(["first", "second"]);
  });

  it("leaves a kit contributing no middleware alone", async () => {
    const app = new Hono();
    const config = defineConfig({ kits: [{ name: "@fixture/quiet" }] });
    setupKitMiddleware(app, config);
    addRoutes(app);

    await expect(ask(app)).resolves.toBe("routed");
  });

  it("takes the app's own config when none is passed", async () => {
    const app = new Hono();
    addRoutes(app);
    setupKitMiddleware(app);

    await expect(ask(app)).resolves.toBe("routed");
  });
});

describe("composeApp", () => {
  // The whole point of the slot: mounted behind, it would never have run.
  it("runs a kit's middleware ahead of the app's own route", async () => {
    const app = new Hono();
    addRoutes(app);
    const config = defineConfig({ kits: [refusingKit("/who")] });

    await expect(ask(composeApp(app, config), "POST")).resolves.toBe("refused");
  });

  it("leaves a route no kit's middleware claimed to the app", async () => {
    const app = new Hono();
    addRoutes(app);
    const config = defineConfig({ kits: [refusingKit("/other")] });

    await expect(ask(composeApp(app, config), "POST")).resolves.toBe("routed");
  });
});
