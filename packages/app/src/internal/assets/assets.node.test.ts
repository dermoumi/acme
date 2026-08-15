import { describe, expect, it } from "vitest";
import { resolveAssets } from "./index";

const ASSETS_DIR = "./src/internal/assets/fixtures/assets";

describe("resolveAssets on a host with no binding", () => {
  it("names the variable to set when no directory is named", () => {
    expect(() => resolveAssets({})).toThrow("set ASSETS_DIR");
  });

  it("derives the variable from the binding the app chose", () => {
    expect(() => resolveAssets({}, { binding: "STATIC" })).toThrow(
      "set STATIC_DIR",
    );
  });

  it("takes the variable name the app names outright", () => {
    expect(() => resolveAssets({}, { dirVar: "WWW_DIR" })).toThrow(
      "set WWW_DIR",
    );
  });

  it("wires a directory once, since it answers per request", () => {
    const env = { ASSETS_DIR };

    expect(resolveAssets(env)).toBe(resolveAssets(env));
  });
});
