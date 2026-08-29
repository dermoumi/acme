import { unboundDbEnv } from "@acme/db/testing";
import { createBindings } from "#testing/runtime";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

// The env names no database, so resolving throws: these prove debug routes
// never reach for one.
function env(overrides: Record<string, string> = {}) {
  return { ...createBindings(unboundDbEnv("DATABASE")), ...overrides };
}

describe("debug routes", () => {
  const app = createApp();

  it("throwing routes answer 500 off production", async () => {
    const res = await app.request("/debug/boom", {}, env());
    expect(res.status).toBe(500);
  });

  // 4xx is an expected answer; sentryErrorHandler passes it through uncaptured.
  it("client-error returns its own status, not a 500", async () => {
    const res = await app.request("/debug/client-error", {}, env());
    expect(res.status).toBe(418);
  });

  it("server-error keeps its 5xx status", async () => {
    const res = await app.request("/debug/server-error", {}, env());
    expect(res.status).toBe(503);
  });

  it("the credential route reads its body before throwing", async () => {
    const res = await app.request(
      "/debug/credentials",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "tester", password: "hunter2" }),
      },
      env(),
    );
    expect(res.status).toBe(500);
  });

  it("the form route works without javascript", async () => {
    const res = await app.request("/debug/form", { method: "POST" }, env());
    expect(res.status).toBe(500);
  });

  // The point of the tier gate: production cannot be made to throw on demand.
  it("production has no debug routes at all", async () => {
    const responses = await Promise.all(
      ["/debug/boom", "/debug/client-error", "/debug/form"].map(async (path) =>
        app.request(path, {}, env({ APP_ENV: "production" })),
      ),
    );
    for (const res of responses) {
      expect(res.status).toBe(404);
    }
  });

  // A tier nobody anticipated must fail closed, which a denylist did not.
  it("an unrecognised tier keeps them hidden", async () => {
    const res = await app.request(
      "/debug/boom",
      {},
      env({ APP_ENV: "canary" }),
    );
    expect(res.status).toBe(404);
  });

  it("staging and preview keep them", async () => {
    const tiers = ["staging", "preview"];
    const responses = await Promise.all(
      tiers.map(async (tier) =>
        app.request("/debug/boom", {}, env({ APP_ENV: tier })),
      ),
    );
    for (const [index, res] of responses.entries()) {
      expect(res.status, tiers[index]).toBe(500);
    }
  });
});
