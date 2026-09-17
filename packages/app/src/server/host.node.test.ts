import { getConnInfo } from "@hono/node-server/conninfo";
import type { HttpBindings } from "@hono/node-server";
import type { Context } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { buildEnv } from "./host.node";

const PEER = "::ffff:10.1.2.3";
// What the websocket upgrade path adds beside the socket.
const EXTRA = Symbol("waitForWebSocket");

// Only the socket is read, so the rest of an IncomingMessage is beside the
// point.
function buildBindings(): HttpBindings {
  const incoming = {
    socket: { remoteAddress: PEER, remoteFamily: "IPv6", remotePort: 7 },
  };

  return { incoming, outgoing: {}, [EXTRA]: true } as unknown as HttpBindings;
}

describe("buildEnv", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("hands a kit the values the deployment was given", () => {
    process.env.DATABASE_URL = "postgres://declared";

    const env = buildEnv(buildBindings());

    expect(env.DATABASE_URL).toBe("postgres://declared");
  });

  // Without this every caller looks the same to a rate limiter, which keys on
  // the address it cannot find.
  it("leaves the socket where the conninfo helper reads it", () => {
    const ctx = { env: buildEnv(buildBindings()) } as Context;

    expect(getConnInfo(ctx).remote.address).toBe(PEER);
  });

  // The adapter reads `incoming` off the env with no fallback, so a websocket
  // upgrade answers 500 if it is not there under its own name.
  it("keeps every binding under the name the adapter reads", () => {
    const env = buildEnv(buildBindings());

    expect(env.incoming).toBeDefined();
    expect(env.outgoing).toBeDefined();
    expect(env[EXTRA as unknown as string]).toBe(true);
  });

  // The env reaches every kit through `vars`, and one that enumerates it must
  // not find a live socket and response stream in there.
  it("keeps the bindings out of what enumerates the environment", () => {
    process.env.DATABASE_URL = "postgres://declared";

    const env = buildEnv(buildBindings());

    expect(Object.keys(env)).toContain("DATABASE_URL");
    expect(Object.keys(env)).not.toContain("incoming");
    expect(Object.keys(env)).not.toContain("outgoing");
    expect(JSON.stringify(env)).not.toContain("remoteAddress");
  });
});
