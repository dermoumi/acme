import { defineConfig, type Kit } from "@acme/app";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { kitVars } from "./kit-vars";

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

const ask = async (app: Hono, env: unknown = {}) => {
  const request = new Request("http://app.test/who");
  const response = await app.fetch(request, env);

  return response.text();
};

describe("kitVars", () => {
  it("puts every declared kit's variables on the request", async () => {
    const app = new Hono();
    const config = defineConfig({ kits: [greeter] });

    const middleware = kitVars(config);
    app.use(middleware);

    app.get("/who", (ctx) => ctx.text(ctx.var.greeting));

    await expect(ask(app, { GREETING: "hei" })).resolves.toBe("hei");
  });

  it("leaves a kit declaring no variables alone", async () => {
    const app = new Hono();
    const config = defineConfig({ kits: [{ name: "quiet" }] });

    const middleware = kitVars(config);
    app.use(middleware);

    app.get("/who", (ctx) => ctx.text("routed"));

    await expect(ask(app)).resolves.toBe("routed");
  });
});
