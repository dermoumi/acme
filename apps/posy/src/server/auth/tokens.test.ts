import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./tokens";

describe("tokens", () => {
  it("tokens are 43-char base64url", () => {
    expect(generateToken()).toMatch(/^[\w-]{43}$/u);
  });

  it("tokens are unique", () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it("hashToken is sha-256 hex", async () => {
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
