import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Kit } from "../internal/config";
import { getConfigFile, run, runWithConfig } from "./acme";
import appConfig from "./fixtures/app/acme.config";
import { type CliContext, sandbox } from "./test-utils";

const fixture = (app: string) =>
  path.join(import.meta.dirname, "fixtures", app, "acme.config.ts");
const appConfigUrl = new URL("./fixtures/app/acme.config.ts", import.meta.url)
  .href;

const commandsModule = new URL("./fixtures/app/commands.ts", import.meta.url)
  .href;
const shouterModule = new URL("./fixtures/app/shouter.ts", import.meta.url)
  .href;
const resolverModule = new URL("./fixtures/app/resolver.ts", import.meta.url)
  .href;

// The greeter registers what it declares; the shouter only reads it back.
const greeter = (name = "@fixture/greeter"): Kit => ({
  name,
  config: { greeting: "hello" },
  commands: commandsModule,
});
const shouter = (name = "@fixture/shouter"): Kit => ({
  name,
  commands: shouterModule,
});

describe("runWithConfig", () => {
  sandbox();

  it<CliContext>("runs a command the kit declared", async ({ out }) => {
    expect(
      await runWithConfig(appConfig, ["greet", "world"], appConfigUrl),
    ).toBe(0);
    expect(out).toContain("hello, world");
  });

  it<CliContext>("passes the command its own options", async ({ out }) => {
    expect(
      await runWithConfig(
        appConfig,
        ["greet", "world", "--loud"],
        appConfigUrl,
      ),
    ).toBe(0);
    expect(out).toContain("HELLO, WORLD");
  });

  it<CliContext>("lists the command in help", async ({ out }) => {
    expect(await runWithConfig(appConfig, ["--help"], appConfigUrl)).toBe(0);
    expect(out.join("\n")).toContain("greet");
  });

  // Two shouters, not two greeters: a greeter trips the shared-key check first.
  it<CliContext>("names both kits when they claim one command", async ({
    err,
  }) => {
    const kits = [shouter("@fixture/first"), shouter("@fixture/second")];

    expect(await runWithConfig({ kits }, ["shout", "world"])).toBe(1);
    expect(err.join("\n")).toContain(
      'The "shout" command is registered by multiple kits: @fixture/second, @fixture/first',
    );
  });

  // cac lists Commands only when it has some, and acme now has none.
  it<CliContext>("takes a config declaring no kits at all", async ({ out }) => {
    expect(await runWithConfig({}, ["--help"])).toBe(0);
    expect(out.join("\n")).not.toContain("Commands:");
  });

  it<CliContext>("takes a kit that declares no commands", async ({ out }) => {
    expect(
      await runWithConfig({ kits: [{ name: "@fixture/quiet" }] }, ["--help"]),
    ).toBe(0);
    expect(out.join("\n")).toContain("Usage");
  });

  it<CliContext>("refuses a kit requiring one the app never declared", async ({
    err,
  }) => {
    const kits = [{ ...shouter(), requires: ["@fixture/greeter"] }];

    expect(await runWithConfig({ kits }, ["shout", "world"])).toBe(1);
    expect(err.join("\n")).toContain(
      "@fixture/shouter requires @fixture/greeter, which this app does not declare",
    );
  });

  it<CliContext>("takes a kit whose requirement the app declares", async ({
    out,
  }) => {
    const kits = [{ ...shouter(), requires: ["@fixture/greeter"] }, greeter()];

    expect(await runWithConfig({ kits }, ["shout", "world"])).toBe(0);
    expect(out).toContain("HELLO, world");
  });

  it<CliContext>("names the kit whose module it cannot load", async ({
    err,
  }) => {
    const kits = [{ name: "@fixture/greeter", commands: "./nowhere.ts" }];

    expect(await runWithConfig({ kits }, ["greet", "world"])).toBe(1);
    expect(err.join("\n")).toContain(
      "Commands module from @fixture/greeter cannot be loaded",
    );
  });

  it<CliContext>("names the kit whose module exports no mount", async ({
    err,
  }) => {
    const mount = new URL("./fixtures/app/not-a-mount.ts", import.meta.url)
      .href;

    expect(
      await runWithConfig(
        { kits: [{ name: "@fixture/greeter", commands: mount }] },
        [],
      ),
    ).toBe(1);
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

  // The cause's wording is node's or vite's; this pins that we pass it on.
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

  // Registering at mount, reading at action time: kit order never matters.
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
      '@fixture/shouter requires "greeting", which no declared kit registers',
    );
  });

  it<CliContext>("names both kits when two register one key", async ({
    err,
  }) => {
    const kits = [greeter("@fixture/first"), greeter("@fixture/second")];

    expect(await runWithConfig({ kits }, ["greet", "world"])).toBe(1);
    expect(err.join("\n")).toContain(
      'The "greeting" value is registered by multiple kits: @fixture/second, @fixture/first',
    );
  });
});

describe("resolving a specifier the app wrote in its config", () => {
  sandbox();

  it<CliContext>("takes the config file as the base", async ({ out }) => {
    const argv = ["resolve", "./src/server/db/migrator.ts"];

    expect(await run([...argv, "-c", fixture("app")])).toBe(0);
    expect(out.join("\n")).toContain(
      "cli/fixtures/app/src/server/db/migrator.ts",
    );
  });

  // What a kit pointing at itself with import.meta.url produces.
  it<CliContext>("hands back an absolute specifier unchanged", async ({
    out,
  }) => {
    expect(await run(["resolve", commandsModule, "-c", fixture("app")])).toBe(
      0,
    );
    expect(out).toContain(commandsModule);
  });

  it<CliContext>("says so when no config file was read", async ({ err }) => {
    const kits = [{ name: "@fixture/resolver", commands: resolverModule }];

    expect(await runWithConfig({ kits }, ["resolve", "./anywhere.ts"])).toBe(1);
    expect(err.join("\n")).toContain(
      'cannot resolve "./anywhere.ts": no config file was read',
    );
  });
});
