import { expect, test } from "vitest";
import { generateToken, hashToken } from "./tokens";

test("tokens are 43-char base64url and unique", () => {
  const token = generateToken();
  expect(token).toMatch(/^[\w-]{43}$/u);
  expect(generateToken()).not.toBe(token);
});

test("hashToken is sha-256 hex", async () => {
  expect(await hashToken("abc")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
