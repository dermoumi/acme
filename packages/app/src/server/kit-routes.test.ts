import { defineConfig, type Kit } from "@acme/app";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { setupKitRoutes } from "./kit-routes";

// A catch-all, since that is the shape the ordering has to hold for: mounted
// first it would answer everything the app was about to register.
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

const ask = async (app: Hono, path = "/who") => {
  const response = await app.fetch(new Request(`http://app.test${path}`));

  return response.text();
};

const addRoutes = (app: Hono) => {
  app.get("/who", (ctx) => ctx.text("routed"));
};

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
