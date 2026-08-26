import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_FILE, loadAcmeConfig } from "./config";

interface ConfigContext {
  dir: string;
}

// A hook reaches only its own describe, so every block installs the sandbox.
// Each runs from its own directory, which is what "the default file" means.
const sandbox = () => {
  const cwd = process.cwd();

  beforeEach<ConfigContext>(async (ctx) => {
    ctx.dir = await mkdtemp(path.join(tmpdir(), "acme-config-"));
    process.chdir(ctx.dir);
  });

  afterEach<ConfigContext>(async ({ dir }) => {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  });
};

// Plain ESM per test: only the loader needs a real file, and .mjs needs no
// transform.
async function write(dir: string, name: string, source: string) {
  const file = path.join(dir, name);
  await writeFile(file, source);
  return file;
}

describe("loadAcmeConfig with no file named", () => {
  sandbox();

  it("answers an empty config when there is none to read", async () => {
    await expect(loadAcmeConfig()).resolves.toEqual({});
  });

  it<ConfigContext>("reads the default file when there is one", async ({
    dir,
  }) => {
    await write(dir, CONFIG_FILE, "export default { kits: [] };");

    await expect(loadAcmeConfig()).resolves.toEqual({ kits: [] });
  });
});

describe("loadAcmeConfig with a file named", () => {
  sandbox();

  it<ConfigContext>("reads the default export", async ({ dir }) => {
    const file = await write(
      dir,
      "acme.config.mjs",
      'export default { kits: [{ name: "@fixture/greeter" }] };',
    );

    await expect(loadAcmeConfig(file)).resolves.toEqual({
      kits: [{ name: "@fixture/greeter" }],
    });
  });

  it<ConfigContext>("names the file it could not read", async ({ dir }) => {
    const missing = path.join(dir, "nowhere.mjs");

    await expect(loadAcmeConfig(missing)).rejects.toThrow(
      `could not read ${missing}`,
    );
  });

  it<ConfigContext>("rejects a config that exports no default", async ({
    dir,
  }) => {
    const file = await write(dir, "acme.config.mjs", "export const kits = [];");

    await expect(loadAcmeConfig(file)).rejects.toThrow(
      /must export a config as its default/u,
    );
  });
});
