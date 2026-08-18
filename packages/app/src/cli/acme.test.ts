import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Kit } from "../internal/config";
import { getConfigFile, run, runWithConfig } from "./acme";
import appConfig from "./fixtures/app/acme.config";

const fixture = (app: string) =>
  path.join(import.meta.dirname, "fixtures", app, "acme.config.ts");

const commandsModule = new URL("./fixtures/app/commands.ts", import.meta.url)
  .href;
const shouterModule = new URL("./fixtures/app/shouter.ts", import.meta.url)
  .href;

// The greeter registers what it declares; the shouter only reads it back.
const greeter = (name = "greeter"): Kit => ({
  name,
  config: { greeting: "hello" },
  cli: commandsModule,
});
const shouter = (name = "shouter"): Kit => ({ name, cli: shouterModule });

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

  // Two shouters, not two greeters: the shouter registers nothing, so this
  // reaches the command check instead of tripping the shared-key one first.
  it<CliContext>("names both kits when they claim one command", async ({
    err,
  }) => {
    const kits = [shouter("first"), shouter("second")];

    expect(await runWithConfig({ kits }, ["shout", "world"])).toBe(1);
    expect(err.join("\n")).toContain(
      'The "shout" command is registered by multiple kits: second, first',
    );
  });

  // cac lists Commands only when it has some, and acme now has none.
  it<CliContext>("takes a config declaring no kits at all", async ({ out }) => {
    expect(await runWithConfig({}, ["--help"])).toBe(0);
    expect(out.join("\n")).not.toContain("Commands:");
  });

  it<CliContext>("takes a kit that declares no commands", async ({ out }) => {
    expect(await runWithConfig({ kits: [{ name: "quiet" }] }, ["--help"])).toBe(
      0,
    );
    expect(out.join("\n")).toContain("Usage");
  });

  it<CliContext>("names the kit whose module it cannot load", async ({
    err,
  }) => {
    const kits = [{ name: "greeter", cli: "./nowhere.ts" }];

    expect(await runWithConfig({ kits }, ["greet", "world"])).toBe(1);
    expect(err.join("\n")).toContain(
      "Cli module from greeter cannot be loaded",
    );
  });

  it<CliContext>("names the kit whose module exports no mount", async ({
    err,
  }) => {
    const cli = new URL("./fixtures/app/not-a-mount.ts", import.meta.url).href;

    expect(await runWithConfig({ kits: [{ name: "greeter", cli }] }, [])).toBe(
      1,
    );
    expect(err.join("\n")).toContain("must export its mount as default");
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
    expect(out.join("\n")).toContain("Usage");
  });

  it<CliContext>("says which file it could not read", async ({ err }) => {
    expect(await run(["greet", "-c", fixture("missing")])).toBe(1);
    expect(err.join("\n")).toContain("could not read");
  });

  // The wording of the cause is node's or vite's, not ours; what this pins is
  // that we pass it on instead of printing only our own message.
  it<CliContext>("says what actually went wrong inside the config", async ({
    err,
  }) => {
    const dir = await mkdtemp(path.join(tmpdir(), "acme-broken-"));
    const broken = path.join(dir, "broken.mjs");
    await writeFile(broken, "export default { kits: [] \n");

    expect(await run(["greet", "-c", broken])).toBe(1);
    expect(err.join("\n")).toMatch(/could not read .*broken\.mjs/u);
    expect(err.join("\n")).toMatch(/\n {2}caused by: .+/u);
    await rm(dir, { recursive: true, force: true });
  });

  it<CliContext>("answers 1 and prints usage for an unknown command", async ({
    out,
  }) => {
    expect(await run(["frobnicate", "-c", fixture("app")])).toBe(1);
    expect(out.join("\n")).toContain("Usage");
  });
});

describe("kits reaching what another registered", () => {
  sandbox();

  it<CliContext>("hands over what the other kit registered", async ({
    out,
  }) => {
    const kits = [greeter(), shouter()];

    expect(await runWithConfig({ kits }, ["shout", "world"])).toBe(0);
    expect(out).toContain("HELLO, world");
  });

  // The rule the slot exists for: registering happens at mount, reading at
  // action time, so an app never has to order its kits to suit them.
  it<CliContext>("does not care which order the app listed them in", async ({
    out,
  }) => {
    const kits = [shouter(), greeter()];

    expect(await runWithConfig({ kits }, ["shout", "world"])).toBe(0);
    expect(out).toContain("HELLO, world");
  });

  it<CliContext>("names the kit asking for what nothing registers", async ({
    err,
  }) => {
    expect(await runWithConfig({ kits: [shouter()] }, ["shout", "w"])).toBe(1);
    expect(err.join("\n")).toContain(
      'shouter requires "greeting", which no declared kit registers',
    );
  });

  it<CliContext>("names both kits when two register one key", async ({
    err,
  }) => {
    const kits = [greeter("first"), greeter("second")];

    expect(await runWithConfig({ kits }, ["greet", "world"])).toBe(1);
    expect(err.join("\n")).toContain(
      'The "greeting" value is registered by multiple kits: second, first',
    );
  });
});
