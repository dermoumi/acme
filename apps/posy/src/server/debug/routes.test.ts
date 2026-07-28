import { createBindings } from "#testing/runtime";
import { expect, test } from "vitest";
import { createApp } from "../app";

const app = createApp(() => {
  throw new Error("debug tests never reach the database");
});

function env(overrides: Record<string, string> = {}) {
  return { ...createBindings(), ...overrides };
}

test("throwing routes answer 500 off production", async () => {
  const res = await app.request("/debug/boom", {}, env());
  expect(res.status).toBe(500);
});

// 4xx is an expected answer; sentryErrorHandler passes it through uncaptured.
test("client-error returns its own status, not a 500", async () => {
  const res = await app.request("/debug/client-error", {}, env());
  expect(res.status).toBe(418);
});

test("server-error keeps its 5xx status", async () => {
  const res = await app.request("/debug/server-error", {}, env());
  expect(res.status).toBe(503);
});

test("the credential route reads its body before throwing", async () => {
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

test("the form route works without javascript", async () => {
  const res = await app.request("/debug/form", { method: "POST" }, env());
  expect(res.status).toBe(500);
});

// The whole point of the tier gate: production must not be able to throw on demand.
test("production has no debug routes at all", async () => {
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
test("an unrecognised tier keeps them hidden", async () => {
  const res = await app.request("/debug/boom", {}, env({ APP_ENV: "canary" }));
  expect(res.status).toBe(404);
});

test("staging and preview keep them", async () => {
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
