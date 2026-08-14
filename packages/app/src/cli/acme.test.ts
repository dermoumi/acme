import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Kit } from "../config";
import { getConfigFile, run, runWithConfig } from "./acme";
import appConfig from "./fixtures/app/acme.config";

const fixture = (app: string) =>
  path.join(import.meta.dirname, "fixtures", app, "acme.config.ts");

// A kit is a plain object, so the ones a test needs take no file of their own.
const claims = (name: string): Kit => ({
  name,
  commands: (cli) => {
    cli.command("greet <name>", "say hello").action(() => undefined);
  },
});

interface CliContext {
  out: string[];
  err: string[];
}

// A hook reaches only its own describe, so every block installs the sandbox.
const sandbox = () => {
  beforeEach<CliContext>((ctx) => {
    ctx.out = [];
    ctx.err = [];
    // cac prints help and the version through console.info, not log.
    for (const channel of ["log", "info"] as const) {
      vi.spyOn(console, channel).mockImplementation((...args: unknown[]) => {
        ctx.out.push(args.join(" "));
      });
    }
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      ctx.err.push(args.join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
};

describe("runWithConfig", () => {
  sandbox();

  it<CliContext>("runs a command the kit declared", async ({ out }) => {
    expect(await runWithConfig(appConfig, ["greet", "world"])).toBe(0);
    expect(out).toContain("hello, world");
  });

  it<CliContext>("passes the command its own options", async ({ out }) => {
    expect(await runWithConfig(appConfig, ["greet", "world", "--loud"])).toBe(
      0,
    );
    expect(out).toContain("HELLO, WORLD");
  });

  it<CliContext>("lists the command in help", async ({ out }) => {
    expect(await runWithConfig(appConfig, ["--help"])).toBe(0);
    expect(out.join("\n")).toContain("greet");
  });

  it<CliContext>("keeps the commands acme brought itself", async ({ out }) => {
    expect(await runWithConfig(appConfig, ["--help"])).toBe(0);
    expect(out.join("\n")).toContain("prune");
  });

  it<CliContext>("names both kits when they claim one command", async ({
    err,
  }) => {
    const kits = [claims("first"), claims("second")];

    expect(await runWithConfig({ kits }, ["greet", "world"])).toBe(1);
    expect(err.join("\n")).toContain('second and first both declare "greet"');
  });

  it<CliContext>("takes a config declaring no kits at all", async ({ out }) => {
    expect(await runWithConfig({}, ["--help"])).toBe(0);
    expect(out.join("\n")).toContain("prune");
  });
});

describe("getConfigFile", () => {
  it("takes the file -c names", () => {
    expect(getConfigFile(["greet", "-c", "app.config.ts"])).toBe(
      "app.config.ts",
    );
  });

  it("takes the file --config names", () => {
    expect(getConfigFile(["--config", "app.config.ts", "greet"])).toBe(
      "app.config.ts",
    );
  });

  it("takes the file --config=file names", () => {
    expect(getConfigFile(["greet", "--config=app.config.ts"])).toBe(
      "app.config.ts",
    );
  });

  it("answers nothing when the flag is absent", () => {
    expect(getConfigFile(["greet", "world"])).toBeUndefined();
  });

  it("leaves a flag after -- to the command", () => {
    expect(
      getConfigFile(["greet", "--", "-c", "app.config.ts"]),
    ).toBeUndefined();
  });

  it("answers nothing when the flag names no file", () => {
    expect(getConfigFile(["greet", "--config"])).toBeUndefined();
  });
});

describe("run", () => {
  sandbox();

  it<CliContext>("mounts the kits the file declares", async ({ out }) => {
    expect(await run(["greet", "world", "-c", fixture("app")])).toBe(0);
    expect(out).toContain("hello, world");
  });

  it<CliContext>("still runs when no app declares one", async ({ out }) => {
    expect(await run(["--help"])).toBe(0);
    expect(out.join("\n")).toContain("prune");
  });

  it<CliContext>("says which file it could not read", async ({ err }) => {
    expect(await run(["greet", "-c", fixture("missing")])).toBe(1);
    expect(err.join("\n")).toContain("could not read");
  });
});
