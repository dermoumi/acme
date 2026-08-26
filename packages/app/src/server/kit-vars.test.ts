import { defineConfig, type Kit } from "@acme/app";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { setupKitVars } from "./kit-vars";

// What the kit's own package would declare, so a route needs no import.
declare module "hono" {
  interface ContextVariableMap {
    greeting: string;
  }
}

const greeter: Kit = {
  name: "@fixture/greeter",
  init: () => ({
    vars: (env) => {
      return { greeting: (env as { GREETING?: string }).GREETING ?? "none" };
    },
  }),
};

const createCountingKit = () => {
  const vars = vi.fn(() => ({ greeting: "hei" }));

  return {
    kit: { name: "@fixture/counting", init: () => ({ vars }) },
    vars,
  };
};

const ask = async (app: Hono, env: unknown = {}) => {
  const request = new Request("http://app.test/who");
  const response = await app.fetch(request, env);

  return response.text();
};

describe("setupKitVars", () => {
  it("puts every declared kit's variables on the request", async () => {
    const app = new Hono();
    const config = defineConfig({ kits: [greeter] });

    setupKitVars(app, config);
    app.get("/who", (ctx) => ctx.text(ctx.var.greeting));

    await expect(ask(app, { GREETING: "hei" })).resolves.toBe("hei");
  });

  // Every request in a workerd isolate gets the same env object, so building
  // the values per request would allocate a record and an entry list per kit.
  it("builds a kit's variables once for an environment it has seen", async () => {
    const { kit, vars } = createCountingKit();
    const app = new Hono();
    const config = defineConfig({ kits: [kit] });
    setupKitVars(app, config);
    app.get("/who", (ctx) => ctx.text(ctx.var.greeting));

    const env = { GREETING: "hei" };
    await ask(app, env);
    await ask(app, env);

    expect(vars).toHaveBeenCalledOnce();
  });

  it("builds them again for an environment it has not", async () => {
    const { kit, vars } = createCountingKit();
    const app = new Hono();
    const config = defineConfig({ kits: [kit] });
    setupKitVars(app, config);
    app.get("/who", (ctx) => ctx.text(ctx.var.greeting));

    await ask(app, { GREETING: "hei" });
    await ask(app, { GREETING: "hei" });

    expect(vars).toHaveBeenCalledTimes(2);
  });

  it("sets them on every request, not only the one that built them", async () => {
    const { kit } = createCountingKit();
    const app = new Hono();
    const config = defineConfig({ kits: [kit] });
    setupKitVars(app, config);
    app.get("/who", (ctx) => ctx.text(ctx.var.greeting));

    const env = { GREETING: "hei" };
    await ask(app, env);

    await expect(ask(app, env)).resolves.toBe("hei");
  });

  it("leaves a kit declaring no variables alone", async () => {
    const app = new Hono();
    const config = defineConfig({ kits: [{ name: "@fixture/quiet" }] });

    setupKitVars(app, config);
    app.get("/who", (ctx) => ctx.text("routed"));

    await expect(ask(app)).resolves.toBe("routed");
  });
});
