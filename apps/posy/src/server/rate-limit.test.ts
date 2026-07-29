import { createBindings } from "#testing/runtime";
import { describe, expect, it } from "vitest";
import {
  createApp,
  RATE_LOGIN_LIMIT,
  RATE_LOGIN_PERIOD,
  RATE_TUNNEL_LIMIT,
} from "./app";
import type { AppBindings } from "./bindings";

// @acme/rate-limiter tests the limiter itself. These cover only what posy wires:
// which routes and methods are capped, at which budget, and in which order.
function noDatabase(): never {
  throw new Error("these tests must not reach the database");
}

function testApp() {
  return createApp({ getDialect: noDatabase });
}

// Unique per test: workerd shares one limiter namespace across the whole file.
let clients = 0;
function client(): Record<string, string> {
  clients += 1;
  return { "cf-connecting-ip": `203.0.113.${clients}` };
}

// Recursive rather than a loop: rate limiting is about order, so these requests
// must not overlap, and awaiting inside a loop is banned.
async function sequence(
  times: number,
  run: () => Promise<Response> | Response,
  collected: Response[] = [],
): Promise<Response[]> {
  if (collected.length >= times) return collected;
  collected.push(await run());
  return sequence(times, run, collected);
}

async function post(
  app: ReturnType<typeof testApp>,
  env: AppBindings,
  path: string,
  headers: Record<string, string>,
): Promise<Response> {
  return app.request(path, { method: "POST", headers, body: "{}" }, env);
}

describe("POST /session", () => {
  it("is capped before the handler, and says when to come back", async () => {
    const app = testApp();
    const env = createBindings();
    const headers = client();

    // 401 rather than 429 is the limiter running; 429 on the next is the cap.
    const allowed = await sequence(RATE_LOGIN_LIMIT, () =>
      post(app, env, "/session", headers),
    );
    for (const response of allowed) expect(response.status).toBe(401);

    const refused = await post(app, env, "/session", headers);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe(String(RATE_LOGIN_PERIOD));
  });
});

describe("GET and DELETE /session", () => {
  it("are never capped, whatever login has spent", async () => {
    const app = testApp();
    const env = createBindings();
    const headers = client();

    const reads = await sequence(RATE_LOGIN_LIMIT * 2, () =>
      app.request("/session", { headers }, env),
    );
    for (const response of reads) expect(response.status).toBe(200);

    const ends = await sequence(RATE_LOGIN_LIMIT * 2, () =>
      app.request("/session", { method: "DELETE", headers }, env),
    );
    for (const response of ends) expect(response.status).toBe(204);
  });
});

describe("POST /sentry", () => {
  it("has its own budget, spent separately from login", async () => {
    const app = testApp();
    const env = createBindings();
    const headers = client();

    const allowed = await sequence(RATE_TUNNEL_LIMIT, () =>
      post(app, env, "/sentry", headers),
    );
    for (const response of allowed) expect(response.status).not.toBe(429);
    expect((await post(app, env, "/sentry", headers)).status).toBe(429);

    // Login is untouched by the tunnel spending everything it had.
    expect((await post(app, env, "/session", headers)).status).toBe(401);
  });
});

describe("createApp", () => {
  it("throws on a malformed trusted proxy range", () => {
    // Runs at module load on workerd, so a bad range is a worker that fails to
    // boot rather than one silently trusting nobody for its life.
    expect(() =>
      createApp({ getDialect: noDatabase, trustedProxies: ["10.0.0.0/"] }),
    ).toThrow("10.0.0.0/");

    expect(() =>
      createApp({
        getDialect: noDatabase,
        trustedProxies: ["10.0.0.0/8", "fc00::/7"],
      }),
    ).not.toThrow();
  });
});
