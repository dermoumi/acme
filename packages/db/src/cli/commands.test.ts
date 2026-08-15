import type { Kit } from "@acme/app";
import { runWithConfig } from "@acme/app/cli";
import { describe, expect, it, vi } from "vitest";
import appConfig from "../kit/fixtures/app/acme.config";
import { type CliContext, rows, sandbox, tables } from "./test-utils";

const asker = (name = "asker"): Kit => ({
  name,
  cli: new URL("./fixtures/asker.ts", import.meta.url).href,
});

const withAsker = (): Kit[] => [asker(), ...(appConfig.kits ?? [])];

describe("acme mounting the database kit", () => {
  sandbox();

  it<CliContext>("migrates through the app's own CLI", async ({ main }) => {
    expect(await runWithConfig(appConfig, ["migrate", "--db", "MAIN"])).toBe(0);
    expect(await tables(main)).toEqual(["posts", "users"]);
  });

  it<CliContext>("seeds through the app's own CLI", async ({ main }) => {
    await runWithConfig(appConfig, ["migrate", "--db", "MAIN"]);
    expect(await runWithConfig(appConfig, ["seed", "--db", "MAIN"])).toBe(0);

    expect(await rows(main, "users")).toEqual([{ id: "seeded" }]);
  });

  it("lists both commands in acme's help", async () => {
    const said: string[] = [];
    // cac prints help through console.info, which the sandbox leaves alone.
    vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      said.push(args.join(" "));
    });

    expect(await runWithConfig(appConfig, ["--help"])).toBe(0);
    expect(said.join("\n")).toContain("migrate");
    expect(said.join("\n")).toContain("seed");
  });
});

// Stands in for @acme/auth: a kit reaching a database it never configured.
describe("the database kit registering how to open one", () => {
  sandbox();

  it<CliContext>("opens the database a binding names", async ({ main }) => {
    expect(await runWithConfig({ kits: withAsker() }, ["ask", "MAIN"])).toBe(0);
    expect(await tables(main)).toContain("asked");
  });

  it<CliContext>("opens the one it names, not the first declared", async ({
    analytics,
  }) => {
    expect(
      await runWithConfig({ kits: withAsker() }, ["ask", "ANALYTICS"]),
    ).toBe(0);
    expect(await tables(analytics)).toContain("asked");
  });

  it<CliContext>("refuses a binding the app never declared", async ({
    main,
  }) => {
    expect(await runWithConfig({ kits: withAsker() }, ["ask", "NOPE"])).toBe(1);
    expect(await tables(main)).toEqual([]);
  });

  it<CliContext>("says so when no database kit is declared at all", async () => {
    expect(await runWithConfig({ kits: [asker()] }, ["ask", "MAIN"])).toBe(1);
  });
});
