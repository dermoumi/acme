import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acmeVite } from "./plugin";

const root = fileURLToPath(new URL("fixtures/shop", import.meta.url));

// Vite types its hooks as unions with an object form; these are the plain
// functions the plugin declares.
interface VirtualPlugin {
  configResolved: (config: { root: string }) => void;
  load: (id: string) => string | undefined;
}

// The virtual id, prefixed the way `resolveId` answered it.
const loadConfigModule = (
  options: { withoutConfig?: boolean } = {},
): string => {
  const [virtual] = acmeVite({
    ...options,
    root,
  }) as unknown as VirtualPlugin[];
  virtual?.configResolved({ root });

  return String(virtual?.load("\0virtual:acme-config"));
};
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

  // A package's own tests are the case: they reach a testing helper that
  // imports the id, and have no kits of their own.
  it("serves an empty config to a caller saying it has none", () => {
    expect(loadConfigModule({ withoutConfig: true })).toContain(
      "export default {}",
    );
  });

  // An app that moved or renamed its config would otherwise build with no kits.
  it("fails on a missing config the caller never said it was without", () => {
    expect(loadConfigModule).toThrow(/acme config not found/u);
  });

  it("stamps the app's name and version off its package.json", () => {
    void acmeVite({ root });

    expect(process.env.VITE_APP_NAME).toBe("shop");
    expect(process.env.VITE_APP_VERSION).toBe("420.69.42");
  });

  it("stamps a development tier and a dev build when nothing says otherwise", () => {
    void acmeVite({ root });

    expect(process.env.VITE_APP_ENV).toBe("development");
    expect(process.env.VITE_APP_REVISION).toBe("dev");
  });

  it("prefers what the deployment set", () => {
    vi.stubEnv("APP_NAME", "renamed");
    vi.stubEnv("APP_REVISION", "abc1234");
    void acmeVite({ root });

    expect(process.env.VITE_APP_NAME).toBe("renamed");
    expect(process.env.VITE_APP_REVISION).toBe("abc1234");
  });

  // CI hands over an unset secret as "", which must not beat the fallback.
  it("falls back for a var set to an empty string", () => {
    vi.stubEnv("APP_VERSION", "");
    void acmeVite({ root });

    expect(process.env.VITE_APP_VERSION).toBe("420.69.42");
  });

  it("climbs to the nearest package.json above it", () => {
    void acmeVite({ root: import.meta.dirname });

    expect(process.env.VITE_APP_NAME).toBe("app");
  });

  it("names the app after its directory where there is no package.json", () => {
    void acmeVite({ root: "/nowhere/storefront" });

    expect(process.env.VITE_APP_NAME).toBe("storefront");
    expect(process.env.VITE_APP_VERSION).toBe("0.0.0");
  });
});
