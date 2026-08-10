import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AcmeConfig,
  databaseTarget,
  databases,
  loadAcmeConfig,
} from "./config";

const fixture = (name: string) =>
  path.join(import.meta.dirname, "fixtures", name, "acme.config.ts");

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

  it("reads the config itself when it is not given one", async () => {
    await expect(
      databaseTarget("MAIN", await loadAcmeConfig(fixture("one"))),
    ).resolves.toMatchObject({ binding: "MAIN", urlVar: "MAIN_DSN" });
  });
});

describe("loadAcmeConfig", () => {
  it("reads the default export", async () => {
    await expect(loadAcmeConfig(fixture("one"))).resolves.toEqual({
      db: { binding: "MAIN", urlVar: "MAIN_DSN" },
    });
  });

  it("names the file it could not read", async () => {
    const missing = fixture("nowhere");
    await expect(loadAcmeConfig(missing)).rejects.toThrow(
      `could not read ${missing}`,
    );
  });

  it("rejects a binding declared twice, whoever is reading", async () => {
    await expect(loadAcmeConfig(fixture("duplicate"))).rejects.toThrow(
      /declares SAME twice/u,
    );
  });

  it("rejects a config that exports no default", async () => {
    await expect(loadAcmeConfig(fixture("no-default"))).rejects.toThrow(
      /must export a config as its default/u,
    );
  });
});
