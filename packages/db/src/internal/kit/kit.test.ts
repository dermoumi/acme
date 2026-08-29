import type { Kit } from "@acme/app";
import type { HealthStatus } from "@acme/health";
import { stubHealthKit } from "@acme/health/testing";
import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDbEnv } from "../../testing";
import { openDbAccessors } from "../db";
import { databaseKit } from "./kit";

// Spied, not replaced: all this needs to know is when it happens.
vi.mock("../db", { spy: true });

const getHealthStatus = (kit: Kit): HealthStatus => {
  const health = stubHealthKit("@acme/db");
  kit.init?.(health.context);

  return health.status("database");
};

// The status reads only the env, which is what a host hands the context.
const buildContext = (env: unknown) => {
  return { env } as Context;
};

describe("databaseKit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names itself by its specifier, so a reader can find it back", () => {
    expect(databaseKit([{ binding: "MAIN" }])).toMatchObject({
      name: "@acme/db",
    });
  });

  it("carries every database it was given, in order", () => {
    const declared = [{ binding: "MAIN" }, { binding: "ANALYTICS" }];
    expect(databaseKit(declared).config).toEqual(declared);
  });

  it("takes an app that declares no database at all", () => {
    expect(databaseKit([]).config).toEqual([]);
  });

  it("rejects a binding declared twice", () => {
    expect(() =>
      databaseKit([
        { binding: "SAME" },
        { binding: "OTHER" },
        { binding: "SAME" },
      ]),
    ).toThrow(/SAME is declared more than once/u);
  });

  // The vite plugin reads acme.config.ts on a build machine, so a declared kit
  // that opened anything would be opening it there.
  it("opens nothing until something builds it", () => {
    const kit = databaseKit([{ binding: "MAIN" }]);
    expect(openDbAccessors).not.toHaveBeenCalled();

    kit.init?.(stubHealthKit("@acme/db").context);

    expect(openDbAccessors).toHaveBeenCalledOnce();
  });

  // Nothing else memoizes it, so a second reader of one declaration would
  // otherwise land on a second set of connections.
  it("opens one declaration's databases once, however often it is built", () => {
    const kit = databaseKit([{ binding: "MAIN" }]);

    kit.init?.(stubHealthKit("@acme/db").context);
    kit.init?.(stubHealthKit("@acme/db").context);

    expect(openDbAccessors).toHaveBeenCalledOnce();
  });

  it("reports a database it can query as ok", async () => {
    const status = getHealthStatus(databaseKit([{ binding: "DATABASE" }]));
    const env = await emptyDbEnv("DATABASE");

    await expect(status(buildContext(env))).resolves.toBe("ok");
  });

  // The binding is only opened on first use, so nothing else notices.
  it("reports a database it cannot open as down", async () => {
    const status = getHealthStatus(databaseKit([{ binding: "DATABASE" }]));

    await expect(status(buildContext({}))).resolves.toBe("down");
  });

  it("puts a getDb on every request it reaches", () => {
    const { vars } =
      databaseKit([{ binding: "MAIN" }]).init?.(
        stubHealthKit("@acme/db").context,
      ) ?? {};

    expect(vars?.({})).toHaveProperty("getDb", expect.any(Function));
  });

  it("declares where its commands live, for the CLI to resolve", () => {
    expect(databaseKit([]).commands).toBe("@acme/db/commands");
  });
});
