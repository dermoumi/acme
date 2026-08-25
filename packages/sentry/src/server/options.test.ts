import { describe, expect, it } from "vitest";
import type { MaskingLevel, SentryConfig } from "./config";
import { buildSentryOptions } from "./options";

const DSN = "https://dummy@dummy.ingest.sentry.io/1";

describe("buildSentryOptions", () => {
  it("no DSN yields no options, so monitoring stays a silent no-op", () => {
    expect(buildSentryOptions({})).toBeUndefined();
    expect(buildSentryOptions({ APP_ENV: "staging" })).toBeUndefined();
  });

  it("takes the dsn the config reads, not the default value", () => {
    const bound = { REPORTING_DSN: DSN };
    const config: SentryConfig = {
      settings: (env) => {
        return { dsn: env.REPORTING_DSN };
      },
    };

    expect(buildSentryOptions(bound)).toBeUndefined();
    expect(buildSentryOptions(bound, config)?.dsn).toBe(DSN);
  });

  it("takes the release and tier the config reads", () => {
    const bound = {
      SENTRY_DSN: DSN,
      SERVICE: "shop",
      TIER: "staging",
      BUILD_VERSION: "1.2.3",
      BUILD_SHA: "abc1234",
    };
    const config: SentryConfig = {
      settings: (env) => {
        return {
          appName: env.SERVICE,
          appEnv: env.TIER,
          appVersion: env.BUILD_VERSION,
          appRevision: env.BUILD_SHA,
        };
      },
    };
    const options = buildSentryOptions(bound, config);

    expect(options?.environment).toBe("staging");
    expect(options?.release).toBe("shop@1.2.3+abc1234");
    expect(options?.dist).toBe("abc1234");
  });

  // A stale value under the default name would otherwise quietly win.
  it("ignores the default name for a setting the config reads", () => {
    const bound = { SENTRY_DSN: DSN, APP_ENV: "production", TIER: "staging" };
    const config: SentryConfig = {
      settings: (env) => {
        return { appEnv: env.TIER };
      },
    };
    const options = buildSentryOptions(bound, config);

    expect(options?.environment).toBe("staging");
  });

  // Reading one setting must not cost an app the four it did not name.
  it("keeps the default name for a setting the config leaves out", () => {
    const bound = { REPORTING_DSN: DSN, APP_ENV: "staging" };
    const config: SentryConfig = {
      settings: (env) => {
        return { dsn: env.REPORTING_DSN };
      },
    };
    const options = buildSentryOptions(bound, config);

    expect(options?.environment).toBe("staging");
  });

  it("carries the dsn, environment and release through", () => {
    const options = buildSentryOptions({
      SENTRY_DSN: DSN,
      APP_NAME: "posy",
      APP_ENV: "production",
      APP_VERSION: "1.2.3",
      APP_REVISION: "abc1234",
    });
    expect(options?.dsn).toBe(DSN);
    expect(options?.environment).toBe("production");
    expect(options?.release).toBe("posy@1.2.3+abc1234");
    expect(options?.dist).toBe("abc1234");
  });

  it("falls back to a development environment and a dev build", () => {
    const options = buildSentryOptions({ SENTRY_DSN: DSN });
    expect(options?.environment).toBe("development");
    expect(options?.release).toBe("dev+dev");
    expect(options?.dist).toBe("dev");
  });

  // Last, so a caller can override anything the env and the masking produced,
  // and so everything reading these options agrees on what they say.
  it("merges the config's own options over the rest", () => {
    const env = { SENTRY_DSN: DSN, APP_ENV: "production" };
    const config = { options: { environment: "canary", sampleRate: 0.5 } };

    const options = buildSentryOptions(env, config);

    expect(options?.environment).toBe("canary");
    expect(options?.sampleRate).toBe(0.5);
    expect(options?.dsn).toBe(DSN);
  });

  it("scrubs every event before sending", () => {
    const beforeSend = buildSentryOptions({ SENTRY_DSN: DSN })?.beforeSend;
    const event = {
      type: undefined,
      request: { data: JSON.stringify({ password: "PLAINPASS" }) },
    };
    expect(JSON.stringify(beforeSend?.(event, {}))).not.toContain("PLAINPASS");
  });

  // Guards the trap: any category left unlisted silently reverts to permissive.
  it("every data collection category is named, defaulting to full masking", () => {
    expect(buildSentryOptions({ SENTRY_DSN: DSN })?.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: {
          deny: [
            "authorization",
            "cookie",
            "proxy-authorization",
            "set-cookie",
          ],
        },
        response: false,
      },
      httpBodies: ["incomingRequest"],
      urlQueryParams: true,
      databaseQueryData: false,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
    });
  });

  it("only full withholds database query data", () => {
    const dbData = (masking: MaskingLevel) =>
      buildSentryOptions({ SENTRY_DSN: DSN }, { masking })?.dataCollection
        ?.databaseQueryData;
    expect(dbData("none")).toBe(true);
    expect(dbData("light")).toBe(true);
    expect(dbData("full")).toBe(false);
  });

  it("none keeps values but still strips credentials", () => {
    const beforeSend = buildSentryOptions(
      { SENTRY_DSN: DSN },
      { masking: "none" },
    )?.beforeSend;
    const event = {
      type: undefined,
      request: {
        headers: { Authorization: "Bearer LEAK", "User-Agent": "probe" },
        data: JSON.stringify({ password: "PLAINPASS" }),
      },
    };
    const sent = JSON.stringify(beforeSend?.(event, {}));
    expect(sent).not.toContain("LEAK");
    expect(sent).toContain("probe");
    expect(sent).toContain("PLAINPASS");
  });
});
