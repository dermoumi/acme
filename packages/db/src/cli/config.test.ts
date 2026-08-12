import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type AcmeConfig,
  databaseTarget,
  databases,
  loadAcmeConfig,
  validateAcmeConfig,
} from "./config";

describe("databases", () => {
  it("takes a single database", () => {
    const config: AcmeConfig = { db: { binding: "MAIN" } };
    expect(databases(config)).toEqual([{ binding: "MAIN" }]);
  });

  it("takes an array of them", () => {
    const db = [{ binding: "MAIN" }, { binding: "ANALYTICS" }];
    expect(databases({ db })).toEqual(db);
  });

  it("takes none", () => {
    expect(databases({})).toEqual([]);
  });
});

describe("validateAcmeConfig", () => {
  it("hands back a config it is happy with", () => {
    const config: AcmeConfig = { db: [{ binding: "MAIN" }] };
    expect(validateAcmeConfig(config)).toBe(config);
  });

  it("rejects a binding declared twice", () => {
    expect(() =>
      validateAcmeConfig({
        db: [{ binding: "SAME" }, { binding: "OTHER" }, { binding: "SAME" }],
      }),
    ).toThrow(/declares SAME twice/u);
  });

  it("names where the config came from", () => {
    expect(() =>
      validateAcmeConfig({ db: [{ binding: "X" }, { binding: "X" }] }, "/w/e"),
    ).toThrow("/w/e declares X twice");
  });

  it("takes a config with no databases at all", () => {
    expect(validateAcmeConfig({})).toEqual({});
  });
});

describe("databaseTarget", () => {
  const config: AcmeConfig = {
    db: [{ binding: "MAIN" }, { binding: "ANALYTICS", urlVar: "OTHER" }],
  };

  it("finds a database by its binding", async () => {
    await expect(databaseTarget("ANALYTICS", config)).resolves.toMatchObject({
      binding: "ANALYTICS",
      urlVar: "OTHER",
    });
  });

  it("names the declared bindings when asked for one that is not", async () => {
    await expect(databaseTarget("NOPE", config)).rejects.toThrow(
      /no database bound to NOPE: MAIN, ANALYTICS/u,
    );
  });
});

describe("loadAcmeConfig", () => {
  let dir = "";

  // Written per test rather than checked in: only the loader needs a real
  // file, and plain ESM keeps these readable next to what they assert.
  async function config(source: string): Promise<string> {
    const file = path.join(dir, "acme.config.mjs");
    await writeFile(file, source);
    return file;
  }

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "acme-db-config-"));
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("reads the default export", async () => {
    const file = await config(
      'export default { db: { binding: "MAIN", urlVar: "MAIN_DSN" } };',
    );
    await expect(loadAcmeConfig(file)).resolves.toEqual({
      db: { binding: "MAIN", urlVar: "MAIN_DSN" },
    });
  });

  it("names the file it could not read", async () => {
    const missing = path.join(dir, "nowhere.mjs");
    await expect(loadAcmeConfig(missing)).rejects.toThrow(
      `could not read ${missing}`,
    );
  });

  it("rejects a config that exports no default", async () => {
    const file = await config("export const notTheDefault = 1;");
    await expect(loadAcmeConfig(file)).rejects.toThrow(
      /must export a config as its default/u,
    );
  });

  it("validates what it loaded, naming the file", async () => {
    const file = await config(
      'export default { db: [{ binding: "SAME" }, { binding: "SAME" }] };',
    );
    await expect(loadAcmeConfig(file)).rejects.toThrow(
      `${file} declares SAME twice`,
    );
  });
});
