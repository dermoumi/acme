import { afterEach, describe, expect, it } from "vitest";
import { sentryVite } from "./index";

function sourcemapSetting(plugins: unknown): unknown {
  const [first] = plugins as {
    config: () => { build: { sourcemap: unknown } };
  }[];
  return first?.config().build.sourcemap;
}

afterEach(() => {
  delete process.env.SENTRY_AUTH_TOKEN;
});

describe("sentryVite", () => {
  it("emits hidden maps when a token is available", () => {
    expect(sourcemapSetting(sentryVite({ authToken: "t" }))).toBe("hidden");
  });

  it("reads the token from the environment", () => {
    process.env.SENTRY_AUTH_TOKEN = "t";
    expect(sourcemapSetting(sentryVite())).toBe("hidden");
  });

  it("emits no maps without a token", () => {
    expect(sourcemapSetting(sentryVite())).toBe(false);
  });
});
