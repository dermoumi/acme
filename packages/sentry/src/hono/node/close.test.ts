import { captureException } from "@sentry/core";
import { describe, expect, it } from "vitest";
import { bench } from "../testing/bench.node.ts";
import { DSN } from "../testing/contract";
import { closeSentry } from "./close";

const OUTSIDE = "DUMMY-REPORTED-WITHOUT-A-REQUEST";

describe("closeSentry", () => {
  it("delivers a report made outside a request", async () => {
    const { sent } = bench.build({ SENTRY_DSN: DSN }, {});

    // The error handler flushes per request, so this is the path it misses.
    captureException(new Error(OUTSIDE));
    await closeSentry();

    expect(JSON.stringify(sent)).toContain(OUTSIDE);
  });

  it("resolves when no client was ever initialised", async () => {
    bench.build({}, {});

    await expect(closeSentry()).resolves.toBeUndefined();
  });

  it("stops reporting once it has closed", async () => {
    const { sent } = bench.build({ SENTRY_DSN: DSN }, {});
    await closeSentry();

    captureException(new Error(OUTSIDE));
    await closeSentry();

    expect(JSON.stringify(sent)).not.toContain(OUTSIDE);
  });
});
