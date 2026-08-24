import { defineConfig, type Handler, type Kit } from "@acme/app";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { wrapWithKits } from "./kit-handler";

// Each wrapper stamps what it saw, so the answer spells out the order they were
// applied in rather than only that they were.
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

const ask = async (handler: Handler) => {
  const response = await handler.fetch(new Request("http://app.test/who"), {});

  return response.text();
};

const buildApp = () => {
  return new Hono().get("/who", (ctx) => ctx.text("routed"));
};

describe("wrapWithKits", () => {
  it("puts a declared kit's wrapper around the handler", async () => {
    const app = buildApp();
    const config = defineConfig({ kits: [stampingKit("kit")] });

    await expect(ask(wrapWithKits(app, config))).resolves.toBe("kit(routed)");
  });

  // Outermost first, so a kit establishing something has it in place for every
  // kit the config lists after it.
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
