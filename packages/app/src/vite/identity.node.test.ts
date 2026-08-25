import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acmeVite } from "./plugin";

const root = fileURLToPath(new URL("fixtures/shop", import.meta.url));
const STAMPED = ["APP_NAME", "APP_VERSION", "APP_ENV", "APP_REVISION"];
const CLEARED = [...STAMPED, ...STAMPED.map((name) => `VITE_${name}`)];

describe("acmeVite", () => {
  // One process.env for the whole file, and the plugin writes to it.
  beforeEach(() => {
    for (const name of CLEARED) {
      // undefined is how stubEnv unsets one, not a value it could do without.
      // oxlint-disable-next-line unicorn/no-useless-undefined
      vi.stubEnv(name, undefined);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stamps the app's name and version off its package.json", () => {
    acmeVite({ root });

    expect(process.env.VITE_APP_NAME).toBe("shop");
    expect(process.env.VITE_APP_VERSION).toBe("420.69.42");
  });

  it("stamps a development tier and a dev build when nothing says otherwise", () => {
    acmeVite({ root });

    expect(process.env.VITE_APP_ENV).toBe("development");
    expect(process.env.VITE_APP_REVISION).toBe("dev");
  });

  it("prefers what the deployment set", () => {
    vi.stubEnv("APP_NAME", "renamed");
    vi.stubEnv("APP_REVISION", "abc1234");
    acmeVite({ root });

    expect(process.env.VITE_APP_NAME).toBe("renamed");
    expect(process.env.VITE_APP_REVISION).toBe("abc1234");
  });

  // CI hands over an unset secret as "", which must not beat the fallback.
  it("falls back for a var set to an empty string", () => {
    vi.stubEnv("APP_VERSION", "");
    acmeVite({ root });

    expect(process.env.VITE_APP_VERSION).toBe("420.69.42");
  });

  it("climbs to the nearest package.json above it", () => {
    acmeVite({ root: import.meta.dirname });

    expect(process.env.VITE_APP_NAME).toBe("app");
  });

  it("names the app after its directory where there is no package.json", () => {
    acmeVite({ root: "/nowhere/storefront" });

    expect(process.env.VITE_APP_NAME).toBe("storefront");
    expect(process.env.VITE_APP_VERSION).toBe("0.0.0");
  });
});
