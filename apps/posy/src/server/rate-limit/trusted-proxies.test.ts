import { expect, test } from "vitest";
import {
  compileTrustedProxies,
  isTrusted,
  resolveClientAddress,
} from "./trusted-proxies";

const TRUSTED = compileTrustedProxies(["10.0.0.0/8"]);
const NONE = compileTrustedProxies([]);

test("without trusted proxies the header is never believed", () => {
  expect(resolveClientAddress("10.0.0.2", "9.9.9.9", NONE)).toBe("10.0.0.2");
});

test("an untrusted peer is keyed on itself, not on its forged header", () => {
  expect(resolveClientAddress("203.0.113.7", "9.9.9.9", TRUSTED)).toBe(
    "203.0.113.7",
  );
});

test("a trusted peer's only hop is the client", () => {
  expect(resolveClientAddress("10.0.0.2", "203.0.113.7", TRUSTED)).toBe(
    "203.0.113.7",
  );
});

test("junk prepended by the client cannot shift the result", () => {
  expect(
    resolveClientAddress("10.0.0.2", "9.9.9.9, 203.0.113.7, 10.0.0.1", TRUSTED),
  ).toBe("203.0.113.7");
});

test("a forged trusted-looking hop does not walk the search past the client", () => {
  // Filtering every trusted entry and taking the leftmost would answer 9.9.9.9.
  expect(
    resolveClientAddress(
      "10.0.0.2",
      "9.9.9.9, 10.0.0.99, 203.0.113.7, 10.0.0.1",
      TRUSTED,
    ),
  ).toBe("203.0.113.7");
});

test("an entirely trusted chain falls back to the peer", () => {
  expect(resolveClientAddress("10.0.0.2", "10.0.0.5, 10.0.0.1", TRUSTED)).toBe(
    "10.0.0.2",
  );
  expect(resolveClientAddress("10.0.0.2", undefined, TRUSTED)).toBe("10.0.0.2");
});

test("IPv4-mapped IPv6 peers match IPv4 ranges", () => {
  expect(isTrusted("::ffff:10.0.0.2", TRUSTED)).toBe(true);
  expect(resolveClientAddress("::ffff:10.0.0.2", "203.0.113.7", TRUSTED)).toBe(
    "203.0.113.7",
  );
});

test("prefixes and bare addresses bound what is trusted", () => {
  expect(
    isTrusted("172.16.0.1", compileTrustedProxies(["172.16.0.0/12"])),
  ).toBe(true);
  expect(
    isTrusted("172.32.0.1", compileTrustedProxies(["172.16.0.0/12"])),
  ).toBe(false);
  expect(isTrusted("10.0.0.1", compileTrustedProxies(["10.0.0.1"]))).toBe(true);
  expect(isTrusted("10.0.0.2", compileTrustedProxies(["10.0.0.1"]))).toBe(
    false,
  );
});

test("IPv6 ranges bound the same way, up to a 128 bit prefix", () => {
  const ula = compileTrustedProxies(["fc00::/7"]);
  expect(isTrusted("fd12:3456::1", ula)).toBe(true);
  expect(isTrusted("2001:db8::1", ula)).toBe(false);

  expect(isTrusted("fe80::1234", compileTrustedProxies(["fe80::/10"]))).toBe(
    true,
  );
  expect(isTrusted("::1", compileTrustedProxies(["::1/128"]))).toBe(true);
  expect(isTrusted("fd00::1", compileTrustedProxies(["fd00::1"]))).toBe(true);
});

test("IPv6 ranges do not match across families", () => {
  expect(isTrusted("10.0.0.1", compileTrustedProxies(["fc00::/7"]))).toBe(
    false,
  );
  expect(isTrusted("fd00::1", TRUSTED)).toBe(false);
});

test("one list can hold both families, as a dual-stack proxy needs", () => {
  const both = compileTrustedProxies(["10.0.0.0/8", "fc00::/7"]);
  expect(isTrusted("10.0.0.2", both)).toBe(true);
  expect(isTrusted("fd00::2", both)).toBe(true);
  expect(isTrusted("203.0.113.7", both)).toBe(false);

  // An IPv6 proxy forwarding an IPv4 client is the normal dual-stack shape.
  expect(resolveClientAddress("fd00::1", "203.0.113.7", both)).toBe(
    "203.0.113.7",
  );
});

test("configuration that cannot be parsed refuses to compile", () => {
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

test("an address that cannot be parsed is untrusted, not a config error", () => {
  expect(isTrusted("not-an-ip", TRUSTED)).toBe(false);
  expect(isTrusted("10.0.0.1", NONE)).toBe(false);
});

test("an explicit zero prefix is honoured, since that one is intent", () => {
  expect(isTrusted("203.0.113.7", compileTrustedProxies(["0.0.0.0/0"]))).toBe(
    true,
  );
});

test("ranges compile to numbers, so a request re-parses nothing", () => {
  expect(compileTrustedProxies(["10.0.0.0/8"])).toEqual([
    { v4: true, host: 2n ** 24n, network: 10n },
  ]);
});
