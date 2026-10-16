import { afterEach, describe, expect, it } from "vitest";
import { sentryVite } from "./index";

function getSourcemapSetting(plugins: unknown): unknown {
  const [first] = plugins as {
    config: () => { build: { sourcemap: unknown } };
  }[];
  return first?.config().build.sourcemap;
}

function getWorkerSourcemapSetting(plugins: unknown): unknown {
  const [first] = plugins as {
    config: () => { environments: { ssr: { build: { sourcemap: unknown } } } };
  }[];
  return first?.config().environments.ssr.build.sourcemap;
}

describe("sentryVite", () => {
  afterEach(() => {
    delete process.env.SENTRY_AUTH_TOKEN;
  });

  it("emits hidden maps when a token is available", () => {
    expect(getSourcemapSetting(sentryVite({ authToken: "t" }))).toBe("hidden");
  });

  it("reads the token from the environment", () => {
    process.env.SENTRY_AUTH_TOKEN = "t";
    expect(getSourcemapSetting(sentryVite())).toBe("hidden");
  });

  it("emits no maps without a token", () => {
    expect(getSourcemapSetting(sentryVite())).toBe(false);
  });

  it("emits hidden worker maps when a token is available", () => {
    const plugins = sentryVite({ authToken: "t" });
    expect(getWorkerSourcemapSetting(plugins)).toBe("hidden");
  });

  it("emits no worker maps without a token", () => {
    expect(getWorkerSourcemapSetting(sentryVite())).toBe(false);
  });
});
