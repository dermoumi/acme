import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "./acme";
import { type CliContext, sandbox } from "./test-utils";

interface KitContext extends CliContext {
  dir: string;
  config: string;
}

const COMMANDS = `export default ({ cli }) => {
  cli.command("hello", "greet").action(() => console.log("from the kit"));
};
`;

const declaring = (specifier: string) => {
  return `export default { kits: [{ name: "@fixture/kit", commands: ${JSON.stringify(specifier)} }] };`;
};

// A kit that is a real package, since a bare specifier is resolved by node
// from the app's config and there is no other way to put one there.
const installKit = async (dir: string) => {
  const kit = path.join(dir, "node_modules", "@fixture", "kit");
  await mkdir(kit, { recursive: true });
  await writeFile(
    path.join(kit, "package.json"),
    JSON.stringify({
      name: "@fixture/kit",
      type: "module",
      exports: { "./commands": "./commands.mjs" },
    }),
  );
  await writeFile(path.join(kit, "commands.mjs"), COMMANDS);
};

describe("a kit declaring its commands by bare specifier", () => {
  sandbox();

  beforeEach<KitContext>(async (ctx) => {
    ctx.dir = await mkdtemp(path.join(tmpdir(), "acme-kit-"));
    ctx.config = path.join(ctx.dir, "acme.config.mjs");
    await installKit(ctx.dir);
  });

  afterEach<KitContext>(async ({ dir }) => {
    await rm(dir, { recursive: true, force: true });
  });

  it<KitContext>("mounts what the package exports", async ({ config, out }) => {
    await writeFile(config, declaring("@fixture/kit/commands"));

    expect(await run(["-c", config, "hello"])).toBe(0);
    expect(out).toContain("from the kit");
  });

  it<KitContext>("names the kit when nothing answers the specifier", async ({
    config,
    err,
  }) => {
    await writeFile(config, declaring("@fixture/kit/nowhere"));

    expect(await run(["-c", config, "hello"])).toBe(1);
    expect(err.join("\n")).toContain(
      "Commands module from @fixture/kit cannot be loaded",
    );
  });
});
