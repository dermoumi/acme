/// <reference path="../types.d.ts" />
import { resolve } from "virtual:acme-config";
import { describe, expect, it } from "vitest";

describe("the resolve served with virtual:acme-config", () => {
  it("answers a relative specifier against the config it came from", () => {
    expect(resolve("./commands.ts")).toMatch(/\/fixtures\/app\/commands\.ts$/u);
  });

  it("climbs out of the config's directory", () => {
    expect(resolve("../elsewhere.ts")).toMatch(/\/fixtures\/elsewhere\.ts$/u);
  });

  // Joining one onto the config's directory would answer a path that is not
  // there, and say nothing about it.
  it("answers a bare specifier unchanged, for the caller to resolve", () => {
    expect(resolve("@acme/db/commands")).toBe("@acme/db/commands");
  });
});
