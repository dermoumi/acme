import { expect, test } from "vitest";
import { generateToken, hashToken } from "./tokens";

test("tokens are 43-char base64url", () => {
  expect(generateToken()).toMatch(/^[\w-]{43}$/u);
});

test("tokens are unique", () => {
  expect(generateToken()).not.toBe(generateToken());
});

test("hashToken is sha-256 hex", async () => {
  expect(await hashToken("abc")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
