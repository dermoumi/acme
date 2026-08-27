import { createBindings } from "#testing/runtime";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { testApp } from "./testing/app";
import { gate, type GateBindings, type GateOptions } from "./gate";

function creds(user: string, pass: string): { Authorization: string } {
  return { Authorization: `Basic ${btoa(`${user}:${pass}`)}` };
}

// What a platform binding hands back, and what the gate has to rewrap before
// it can mark one. Built here rather than reached for through @acme/assets.
function createSealedResponse(body: string): Response {
  const res = new Response(body);
  const reject = (): never => {
    throw new TypeError("Can't modify immutable headers.");
  };
  Object.defineProperties(res.headers, {
    set: { value: reject },
    append: { value: reject },
    delete: { value: reject },
  });

  return res;
}

// Routes of the test's own, so nothing here depends on what a kit serves.
function createGatedApp(options: GateOptions = {}) {
  const app = new Hono<{ Bindings: GateBindings }>();
  app.use(gate(options));
  app.get("/page", (ctx) => ctx.text("page"));
  app.get("/immutable", () => createSealedResponse("sealed"));

  return app;
}

const gated = createBindings({
  REQUIRE_AUTH: "1",
  BASIC_AUTH: "alice:secret",
});

describe("gate", () => {
  const app = testApp();

  it("leaves everything open and unmarked when REQUIRE_AUTH is unset", async () => {
    const health = await app.request("/health", {}, createBindings());
    expect(health.status).toBe(200);
    expect(health.headers.get("X-Robots-Tag")).toBeNull();

    const gateOnly = createGatedApp();
    const page = await gateOnly.request("/page", {}, createBindings());
    expect(page.status).toBe(200);
    expect(page.headers.get("X-Robots-Tag")).toBeNull();
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

  it("lets correct credentials through, still marked noindex", async () => {
    const gateOnly = createGatedApp();
    const res = await gateOnly.request(
      "/page",
      { headers: creds("alice", "secret") },
      gated,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("marks a response whose headers it cannot set", async () => {
    const gateOnly = createGatedApp();
    const res = await gateOnly.request(
      "/immutable",
      { headers: creds("alice", "secret") },
      gated,
    );

    expect(await res.text()).toBe("sealed");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("accepts every line of a multi-user secret, colons in passwords included", async () => {
    const multi = createBindings({
      REQUIRE_AUTH: "1",
      BASIC_AUTH: "alice:secret\n\n  bob:pa:ss:word  \n",
    });
    const gateOnly = createGatedApp();
    const alice = await gateOnly.request(
      "/page",
      { headers: creds("alice", "secret") },
      multi,
    );
    expect(alice.status).toBe(200);
    const bob = await gateOnly.request(
      "/page",
      { headers: creds("bob", "pa:ss:word") },
      multi,
    );
    expect(bob.status).toBe(200);
    const truncated = await gateOnly.request(
      "/page",
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
    const unlisted = createGatedApp();

    expect((await unlisted.request("/page", {}, gated)).status).toBe(401);
  });

  it("names the realm it was given in the challenge", async () => {
    const named = createGatedApp({ realm: "Somewhere Else" });
    const res = await named.request("/page", {}, gated);

    expect(res.headers.get("WWW-Authenticate")).toContain(
      'realm="Somewhere Else"',
    );
  });

  it("skips the challenge for any listed path", async () => {
    const listed = createGatedApp({ open: ["/page"] });

    expect((await listed.request("/page", {}, gated)).status).toBe(200);
  });
});
