import { describe, expect, it } from "vitest";
import { buildReleaseName } from "./release";

describe("buildReleaseName", () => {
  it("builds name@version+build", () => {
    const release = buildReleaseName("shop", "0.1.0", "a1b2c3d");

    expect(release).toBe("shop@0.1.0+a1b2c3d");
  });

  // Two deploys of an unbumped version must not share a release.
  it("distinguishes builds of the same version", () => {
    const one = buildReleaseName("shop", "0.1.0", "aaaaaaa");
    const other = buildReleaseName("shop", "0.1.0", "bbbbbbb");

    expect(one).not.toBe(other);
  });

  // Releases are org-scoped, so two apps at one version would collide.
  it("distinguishes apps at the same version and build", () => {
    const shop = buildReleaseName("shop", "0.1.0", "a1b2c3d");
    const other = buildReleaseName("other", "0.1.0", "a1b2c3d");

    expect(shop).not.toBe(other);
  });

  it("drops the prefix when the app name is unknown", () => {
    const release = buildReleaseName(undefined, "0.1.0", "a1b2c3d");

    expect(release).toBe("0.1.0+a1b2c3d");
  });

  it("falls back to dev for missing and empty parts", () => {
    expect(buildReleaseName("shop")).toBe("shop@dev+dev");
    expect(buildReleaseName("shop", "", "")).toBe("shop@dev+dev");
  });
});
