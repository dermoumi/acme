import { bench } from "#testing/bench";
import { describe, expect, it } from "vitest";
import type { MaskingLevel } from "./config";
import { DSN, loginRequest } from "./testing/contract";
import { IDENTIFIED } from "./testing/wired-app";

const IP = "203.0.113.7";

// Structural, because ContextLines puts this file's source inside the event.
function users(sent: unknown[]): unknown[] {
  return (sent as [unknown, [unknown, { user?: unknown }][]][]).flatMap(
    ([, items]) => items.map(([, payload]) => payload.user),
  );
}

async function identify(masking: MaskingLevel): Promise<unknown[]> {
  const { invoke, sent } = bench.build({ SENTRY_DSN: DSN }, { masking });
  await invoke(new Request("https://posy.test/identified", { method: "POST" }));
  await bench.settle();
  return users(sent);
}

describe("sentry hono user context", () => {
  it("sends a user set by the app", async () => {
    expect(await identify("light")).toContainEqual(
      expect.objectContaining(IDENTIFIED),
    );
  });

  // userInfo only gates the inferred ip, so beforeSend has to do this.
  it("drops a user set by the app when masking is full", async () => {
    expect(await identify("full")).not.toContainEqual(
      expect.objectContaining(IDENTIFIED),
    );
  });

  // Sentry infers this from the request headers; nothing of ours sets it.
  it("tags events with the client ip", async () => {
    const { invoke, sent } = bench.build(
      { SENTRY_DSN: DSN },
      { masking: "light" },
    );
    await invoke(
      new Request(loginRequest(), { headers: { "cf-connecting-ip": IP } }),
    );
    await bench.settle();
    expect(users(sent)).toContainEqual(
      expect.objectContaining({ ip_address: IP }),
    );
  });

  it("does not carry one request's user onto the next", async () => {
    const { invoke, sent } = bench.build(
      { SENTRY_DSN: DSN },
      { masking: "light" },
    );

    await invoke(
      new Request("https://posy.test/identified", { method: "POST" }),
    );
    await bench.settle();
    expect(users(sent)).toContainEqual(expect.objectContaining(IDENTIFIED));

    sent.length = 0;
    await invoke(new Request("https://posy.test/session", { method: "POST" }));
    await bench.settle();
    expect(users(sent)).not.toContainEqual(
      expect.objectContaining({ id: IDENTIFIED.id }),
    );
  });
});
