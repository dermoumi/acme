import { createBindings } from "#testing/runtime";
import { expect, test } from "vitest";
import app from "../index";

function creds(user: string, pass: string): { Authorization: string } {
  return { Authorization: `Basic ${btoa(`${user}:${pass}`)}` };
}

const gated = createBindings({
  REQUIRE_AUTH: "1",
  BASIC_AUTH: "alice:secret",
});

test("asset responses have immutable headers", async () => {
  const res = await createBindings().ASSETS.fetch(
    new Request("https://posy.test/"),
  );
  expect(res.status).toBe(200);
  expect(() => {
    res.headers.set("X-Robots-Tag", "noindex");
  }).toThrow(TypeError);
});

test("REQUIRE_AUTH unset: everything open, no noindex header", async () => {
  const health = await app.request("/health", {}, createBindings());
  expect(health.status).toBe(200);
  expect(health.headers.get("X-Robots-Tag")).toBeNull();

  const asset = await app.request("/some/page", {}, createBindings());
  expect(asset.status).toBe(200);
  expect(await asset.text()).toContain("posy fixture");
  expect(asset.headers.get("X-Robots-Tag")).toBeNull();
});

test("REQUIRE_AUTH set without BASIC_AUTH: 503 everywhere, even /health", async () => {
  const broken = createBindings({ REQUIRE_AUTH: "1" });
  const responses = await Promise.all(
    ["/health", "/", "/api/whatever"].map(async (path) =>
      app.request(path, {}, broken),
    ),
  );
  for (const res of responses) {
    expect(res.status).toBe(503);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  }
});

test("unparseable BASIC_AUTH fails closed with 503", async () => {
  const responses = await Promise.all(
    ["no-colon", "alice:ok\ngarbage", ":startswithcolon", "  \n  "].map(
      async (raw) =>
        app.request(
          "/health",
          {},
          createBindings({ REQUIRE_AUTH: "1", BASIC_AUTH: raw }),
        ),
    ),
  );
  for (const res of responses) {
    expect(res.status).toBe(503);
  }
});

test("gated: missing credentials get 401 with noindex", async () => {
  const res = await app.request("/", {}, gated);
  expect(res.status).toBe(401);
  expect(res.headers.get("WWW-Authenticate")).toContain("Posy Staging");
  expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
});

test("gated: wrong credentials get 401", async () => {
  const res = await app.request(
    "/",
    { headers: creds("alice", "wrong") },
    gated,
  );
  expect(res.status).toBe(401);
});

test("gated: correct credentials reach assets, still noindex", async () => {
  const res = await app.request(
    "/",
    { headers: creds("alice", "secret") },
    gated,
  );
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("posy fixture");
  expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
});

test("multi-user secret: both lines work, colons in passwords survive", async () => {
  const multi = createBindings({
    REQUIRE_AUTH: "1",
    BASIC_AUTH: "alice:secret\n\n  bob:pa:ss:word  \n",
  });
  const alice = await app.request(
    "/",
    { headers: creds("alice", "secret") },
    multi,
  );
  expect(alice.status).toBe(200);
  const bob = await app.request(
    "/",
    { headers: creds("bob", "pa:ss:word") },
    multi,
  );
  expect(bob.status).toBe(200);
  const truncated = await app.request(
    "/",
    { headers: creds("bob", "pa") },
    multi,
  );
  expect(truncated.status).toBe(401);
});

test("gated: /health stays open without credentials but gets noindex", async () => {
  const res = await app.request("/health", {}, gated);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok", app: "posy" });
  expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
});
