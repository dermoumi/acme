import type { Envelope, Transport } from "@sentry/core";
import { describe, expect, it } from "vitest";
import { stopWhenUnconfigured } from "./transport";

const ENVELOPE = [{}, []] as unknown as Envelope;

// Replays the given status codes, holding the last one once they run out.
function wrapped(statusCodes: number[]): {
  sends: Envelope[];
  flushes: number[];
  transport: Transport;
} {
  const sends: Envelope[] = [];
  const flushes: number[] = [];
  const inner: Transport = {
    send: (envelope) => {
      const statusCode =
        statusCodes[Math.min(sends.length, statusCodes.length - 1)];
      sends.push(envelope);
      return Promise.resolve({ statusCode });
    },
    flush: (timeout) => {
      flushes.push(timeout ?? 0);
      return Promise.resolve(true);
    },
  };
  return { sends, flushes, transport: stopWhenUnconfigured(() => inner)({}) };
}

describe("stopWhenUnconfigured", () => {
  it("keeps sending while the tunnel accepts", async () => {
    const { sends, transport } = wrapped([200]);
    await transport.send(ENVELOPE);
    await transport.send(ENVELOPE);
    expect(sends).toHaveLength(2);
  });

  // The point of the wrapper: an unconfigured tunnel bills a request per event.
  it("stops sending once the tunnel reports no dsn", async () => {
    const { sends, transport } = wrapped([404]);

    const first = await transport.send(ENVELOPE);
    const second = await transport.send(ENVELOPE);
    const third = await transport.send(ENVELOPE);

    expect(first).toEqual({ statusCode: 404 });
    expect(second).toEqual({});
    expect(third).toEqual({});
    expect(sends).toHaveLength(1);
  });

  it("passes the tunnel's response through untouched while active", async () => {
    const { transport } = wrapped([200]);
    expect(await transport.send(ENVELOPE)).toEqual({ statusCode: 200 });
  });

  // A 502 is the tunnel failing to reach Sentry, not the tunnel being absent.
  it("keeps sending through transient upstream failures", async () => {
    const { sends, transport } = wrapped([502]);
    await transport.send(ENVELOPE);
    await transport.send(ENVELOPE);
    expect(sends).toHaveLength(2);
  });

  it("recovers nothing once disabled, even if the tunnel would answer again", async () => {
    const { sends, transport } = wrapped([404, 200]);
    await transport.send(ENVELOPE);
    await transport.send(ENVELOPE);
    expect(sends).toHaveLength(1);
  });

  it("flush delegates to the wrapped transport", async () => {
    const { flushes, transport } = wrapped([200]);
    await transport.flush(1234);
    expect(flushes).toEqual([1234]);
  });
});
