import { createBindings } from "#testing/runtime";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { testApp } from "../testing/app";
import { gate } from "./gate";

function creds(user: string, pass: string): { Authorization: string } {
  return { Authorization: `Basic ${btoa(`${user}:${pass}`)}` };
}

const gated = createBindings({
  REQUIRE_AUTH: "1",
  BASIC_AUTH: "alice:secret",
});

describe("the ASSETS binding gate has to work around", () => {
  it("answers with headers that cannot be set", async () => {
    const res = await createBindings().ASSETS.fetch(
      new Request("https://posy.test/"),
    );
    expect(res.status).toBe(200);
    expect(() => {
      res.headers.set("X-Robots-Tag", "noindex");
    }).toThrow(TypeError);
  });
});

describe("gate", () => {
  const app = testApp();

  it("leaves everything open and unmarked when REQUIRE_AUTH is unset", async () => {
    const health = await app.request("/health", {}, createBindings());
    expect(health.status).toBe(200);
    expect(health.headers.get("X-Robots-Tag")).toBeNull();

    const asset = await app.request("/some/page", {}, createBindings());
    expect(asset.status).toBe(200);
    expect(await asset.text()).toContain("posy fixture");
    expect(asset.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("answers 503 everywhere, even /health, when REQUIRE_AUTH has no BASIC_AUTH", async () => {
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

  it("fails closed with 503 on an unparseable BASIC_AUTH", async () => {
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
});

describe("gate with credentials required", () => {
  const app = testApp();

  it("challenges a request with no credentials, and marks it noindex", async () => {
    const res = await app.request("/", {}, gated);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Posy Staging");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("challenges wrong credentials", async () => {
    const res = await app.request(
      "/",
      { headers: creds("alice", "wrong") },
      gated,
    );
    expect(res.status).toBe(401);
  });

  it("lets correct credentials reach assets, still marked noindex", async () => {
    const res = await app.request(
      "/",
      { headers: creds("alice", "secret") },
      gated,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("posy fixture");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("accepts every line of a multi-user secret, colons in passwords included", async () => {
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

  it("answers an open path without credentials, still marked noindex", async () => {
    const res = await app.request("/health", {}, gated);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("challenges /health like anything else when it is not listed open", async () => {
    const unlisted = new Hono()
      .use(gate())
      .get("/health", (ctx) => ctx.text("hi"));

    expect((await unlisted.request("/health", {}, gated)).status).toBe(401);
  });

  it("names the realm it was given in the challenge", async () => {
    const named = new Hono()
      .use(gate({ realm: "Somewhere Else" }))
      .get("/", (ctx) => ctx.text("hi"));
    const res = await named.request("/", {}, gated);

    expect(res.headers.get("WWW-Authenticate")).toContain(
      'realm="Somewhere Else"',
    );
  });

  it("skips the challenge for any listed path", async () => {
    const listed = new Hono()
      .use(gate({ open: ["/anything"] }))
      .get("/anything", (ctx) => ctx.text("hi"));

    expect((await listed.request("/anything", {}, gated)).status).toBe(200);
  });
});
