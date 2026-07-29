import { describe, expect, it } from "vitest";
import {
  compileTrustedProxies,
  isTrusted,
  resolveClientAddress,
} from "./trusted-proxies";

const TRUSTED = compileTrustedProxies(["10.0.0.0/8"]);
const NONE = compileTrustedProxies([]);

describe("compileTrustedProxies", () => {
  it("rejects anything it cannot parse", () => {
    // "10.0.0.0/" would otherwise read as prefix 0 and trust every address,
    // since Number("") is 0 and none of the numeric guards call that malformed.
    for (const bad of [
      "nonsense/8",
      "10.0.0.0/999",
      "10.0.0.0/33",
      "fc00::/129",
      "10.0.0.0/",
      "10.0.0.0/ ",
      "10.0.0.0/+8",
      "10.0.0.0/0x8",
    ]) {
      expect(() => compileTrustedProxies([bad])).toThrow(bad);
    }

    // One bad entry rejects the whole list rather than quietly dropping itself.
    expect(() => compileTrustedProxies(["10.0.0.0/8", "10.0.0.0/"])).toThrow();
  });

  it("honours an explicit zero prefix, which is intent", () => {
    expect(isTrusted("203.0.113.7", compileTrustedProxies(["0.0.0.0/0"]))).toBe(
      true,
    );
  });

  it("compiles to numbers, so a request re-parses nothing", () => {
    expect(compileTrustedProxies(["10.0.0.0/8"])).toEqual([
      { v4: true, host: 2n ** 24n, network: 10n },
    ]);
  });
});

describe("isTrusted", () => {
  it("bounds by prefix, and by bare address", () => {
    expect(
      isTrusted("172.16.0.1", compileTrustedProxies(["172.16.0.0/12"])),
    ).toBe(true);
    expect(
      isTrusted("172.32.0.1", compileTrustedProxies(["172.16.0.0/12"])),
    ).toBe(false);
    expect(isTrusted("10.0.0.1", compileTrustedProxies(["10.0.0.1"]))).toBe(
      true,
    );
    expect(isTrusted("10.0.0.2", compileTrustedProxies(["10.0.0.1"]))).toBe(
      false,
    );
  });

  it("bounds IPv6 the same way, up to a 128 bit prefix", () => {
    const ula = compileTrustedProxies(["fc00::/7"]);
    expect(isTrusted("fd12:3456::1", ula)).toBe(true);
    expect(isTrusted("2001:db8::1", ula)).toBe(false);

    expect(isTrusted("fe80::1234", compileTrustedProxies(["fe80::/10"]))).toBe(
      true,
    );
    expect(isTrusted("::1", compileTrustedProxies(["::1/128"]))).toBe(true);
    expect(isTrusted("fd00::1", compileTrustedProxies(["fd00::1"]))).toBe(true);
  });

  it("never matches across address families", () => {
    expect(isTrusted("10.0.0.1", compileTrustedProxies(["fc00::/7"]))).toBe(
      false,
    );
    expect(isTrusted("fd00::1", TRUSTED)).toBe(false);
  });

  it("matches an IPv4 range for an IPv4-mapped IPv6 peer", () => {
    expect(isTrusted("::ffff:10.0.0.2", TRUSTED)).toBe(true);
    expect(
      resolveClientAddress("::ffff:10.0.0.2", "203.0.113.7", TRUSTED),
    ).toBe("203.0.113.7");
  });

  it("holds both families, as a dual-stack proxy needs", () => {
    const both = compileTrustedProxies(["10.0.0.0/8", "fc00::/7"]);
    expect(isTrusted("10.0.0.2", both)).toBe(true);
    expect(isTrusted("fd00::2", both)).toBe(true);
    expect(isTrusted("203.0.113.7", both)).toBe(false);

    // An IPv6 proxy forwarding an IPv4 client is the normal dual-stack shape.
    expect(resolveClientAddress("fd00::1", "203.0.113.7", both)).toBe(
      "203.0.113.7",
    );
  });

  it("treats an unparsable address as untrusted, not an error", () => {
    expect(isTrusted("not-an-ip", TRUSTED)).toBe(false);
    expect(isTrusted("10.0.0.1", NONE)).toBe(false);
  });
});

describe("resolveClientAddress", () => {
  it("never believes the header with no trusted proxies", () => {
    expect(resolveClientAddress("10.0.0.2", "9.9.9.9", NONE)).toBe("10.0.0.2");
  });

  it("keys an untrusted peer on itself, not its header", () => {
    expect(resolveClientAddress("203.0.113.7", "9.9.9.9", TRUSTED)).toBe(
      "203.0.113.7",
    );
  });

  it("takes the only hop behind a trusted peer", () => {
    expect(resolveClientAddress("10.0.0.2", "203.0.113.7", TRUSTED)).toBe(
      "203.0.113.7",
    );
  });

  it("ignores junk the client prepended", () => {
    expect(
      resolveClientAddress(
        "10.0.0.2",
        "9.9.9.9, 203.0.113.7, 10.0.0.1",
        TRUSTED,
      ),
    ).toBe("203.0.113.7");
  });

  it("does not walk past a forged trusted-looking hop", () => {
    // Filtering trusted entries and taking the leftmost answers 9.9.9.9.
    expect(
      resolveClientAddress(
        "10.0.0.2",
        "9.9.9.9, 10.0.0.99, 203.0.113.7, 10.0.0.1",
        TRUSTED,
      ),
    ).toBe("203.0.113.7");
  });

  it("falls back to the peer for an all-trusted chain", () => {
    expect(
      resolveClientAddress("10.0.0.2", "10.0.0.5, 10.0.0.1", TRUSTED),
    ).toBe("10.0.0.2");
    expect(resolveClientAddress("10.0.0.2", undefined, TRUSTED)).toBe(
      "10.0.0.2",
    );
  });
});
