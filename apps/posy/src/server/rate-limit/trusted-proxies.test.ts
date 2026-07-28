import { expect, test } from "vitest";
import { isTrusted, resolveClientAddress } from "./trusted-proxies";

const TRUSTED = ["10.0.0.0/8"];

test("without trusted proxies the header is never believed", () => {
  expect(resolveClientAddress("10.0.0.2", "9.9.9.9", [])).toBe("10.0.0.2");
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
  expect(isTrusted("172.16.0.1", ["172.16.0.0/12"])).toBe(true);
  expect(isTrusted("172.32.0.1", ["172.16.0.0/12"])).toBe(false);
  expect(isTrusted("10.0.0.1", ["10.0.0.1"])).toBe(true);
  expect(isTrusted("10.0.0.2", ["10.0.0.1"])).toBe(false);
});

test("IPv6 ranges do not match across families", () => {
  expect(isTrusted("fd00::1", ["fd00::/8"])).toBe(true);
  expect(isTrusted("2001:db8::1", ["fd00::/8"])).toBe(false);
  expect(isTrusted("10.0.0.1", ["fd00::/8"])).toBe(false);
});

test("malformed configuration narrows trust rather than widening it", () => {
  expect(isTrusted("not-an-ip", TRUSTED)).toBe(false);
  expect(isTrusted("10.0.0.1", ["nonsense/8"])).toBe(false);
  expect(isTrusted("10.0.0.1", ["10.0.0.0/999"])).toBe(false);
  expect(isTrusted("10.0.0.1", [])).toBe(false);
});
