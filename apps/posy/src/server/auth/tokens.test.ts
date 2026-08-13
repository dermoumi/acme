import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./tokens";

describe("generateToken", () => {
  it("returns 43 characters of base64url", () => {
    expect(generateToken()).toMatch(/^[\w-]{43}$/u);
  });

  it("never returns the same token twice", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe("hashToken", () => {
  it("returns the sha-256 of its input, in hex", async () => {
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
