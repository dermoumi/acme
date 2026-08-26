import { describe, expect, it } from "vitest";
import { buildReleaseName } from "./release";

describe("buildReleaseName", () => {
  it("builds package@version+build", () => {
    expect(buildReleaseName("posy", "0.1.0", "a1b2c3d")).toBe(
      "posy@0.1.0+a1b2c3d",
    );
  });

  // Two deploys of an unbumped version must not share a release.
  it("distinguishes builds of the same version", () => {
    expect(buildReleaseName("posy", "0.1.0", "aaaaaaa")).not.toBe(
      buildReleaseName("posy", "0.1.0", "bbbbbbb"),
    );
  });

  // Releases are org-scoped, so two apps at one version would collide.
  it("distinguishes apps at the same version and build", () => {
    expect(buildReleaseName("posy", "0.1.0", "a1b2c3d")).not.toBe(
      buildReleaseName("other", "0.1.0", "a1b2c3d"),
    );
  });

  it("drops the prefix when the app name is unknown", () => {
    expect(buildReleaseName(undefined, "0.1.0", "a1b2c3d")).toBe(
      "0.1.0+a1b2c3d",
    );
  });

  it("falls back to dev for missing and empty parts", () => {
    expect(buildReleaseName("posy")).toBe("posy@dev+dev");
    expect(buildReleaseName("posy", "", "")).toBe("posy@dev+dev");
  });
});
