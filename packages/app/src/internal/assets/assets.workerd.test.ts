import { describe, expect, it } from "vitest";
import { resolveAssets } from "./index";

describe("resolveAssets where the platform supplies the binding", () => {
  it("names the binding it could not find", () => {
    expect(() => resolveAssets({})).toThrow('no assets binding named "ASSETS"');
  });

  it("names the binding the app chose instead", () => {
    expect(() => resolveAssets({}, { binding: "STATIC" })).toThrow(
      'named "STATIC"',
    );
  });
});
