import { serve } from "@hono/node-server";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { bench } from "../testing/bench.node.ts";
import { DSN, loginRequest, PASSWORD } from "../testing/contract";
import { BOOM } from "../testing/wired-app";

describe("sentry middleware on @hono/node-server", () => {
  // The shared contract calls fetch directly; this covers real serving.
  it("captures through a real @hono/node-server", async () => {
    const { invoke, sent } = bench.build({ SENTRY_DSN: DSN }, {});

    const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
      const started = serve(
        { fetch: (request: Request) => invoke(request), port: 0 },
        () => {
          resolve(started);
        },
      );
    });
    const { port } = server.address() as AddressInfo;

    try {
      const res = await fetch(loginRequest(`http://127.0.0.1:${port}`));
      await bench.settle();

      expect(res.status).toBe(500);
      expect(JSON.stringify(sent)).toContain(BOOM);
      expect(JSON.stringify(sent)).not.toContain(PASSWORD);
    } finally {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });
});
