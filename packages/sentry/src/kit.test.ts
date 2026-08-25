import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { DSN } from "./server/testing/contract";
import { sentryKit } from "./kit";

// The shape an app has: its own routes, a sub-app mounted under them, and the
// kit's behind both.
function buildApp(): Hono {
  const app = new Hono();
  const mounted = new Hono();

  mounted.get("/boom", () => {
    throw new Error("sub-app exploded");
  });
  app.get("/boom", () => {
    throw new Error("route exploded");
  });
  app.route("/mounted", mounted);
  sentryKit().init?.().routes?.(app);

  return app;
}

describe("sentryKit", () => {
  it("names itself by its specifier, so a reader can find it back", () => {
    expect(sentryKit()).toMatchObject({ name: "@acme/sentry" });
  });

  it("carries what the app declared, for whoever reads it back", () => {
    expect(sentryKit({ masking: "light" }).config).toEqual({
      masking: "light",
    });
  });

  // The 403 is the tunnel's own cross-origin guard, so only the tunnel answers it.
  it("answers the path the browser posts its events to", async () => {
    const app = buildApp();
    const env = { SENTRY_DSN: DSN };

    const res = await app.request("/sentry", { method: "POST" }, env);

    expect(res.status).toBe(403);
  });

  it("answers a route's failure through Sentry's handler, not Hono's", async () => {
    const app = buildApp();
    const res = await app.request("/boom");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Internal Server Error",
      sentryEventId: null,
    });
  });

  it("covers a sub-app the app mounted before it", async () => {
    const app = buildApp();
    const res = await app.request("/mounted/boom");

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ sentryEventId: null });
  });
});
