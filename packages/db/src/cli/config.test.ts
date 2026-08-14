import path from "node:path";
import { describe, expect, it } from "vitest";
import { databaseNamed, loadDatabases } from "./config";

const at = (...parts: string[]) => path.join(import.meta.dirname, ...parts);

const KIT = at("..", "kit", "fixtures", "app", "acme.config.ts");
const LEGACY = at("fixtures", "legacy", "acme.config.ts");

describe("loadDatabases", () => {
  it("reads what the app declared through the kit", async () => {
    const declared = await loadDatabases(KIT);
    expect(declared.map((entry) => entry.binding)).toEqual([
      "MAIN",
      "ANALYTICS",
      "RENAMED",
    ]);
  });

  // The shape posy still uses; it goes when posy declares the kit.
  it("falls back to the db section an older app declared", async () => {
    const declared = await loadDatabases(LEGACY);
    expect(declared.map((entry) => entry.binding)).toEqual(["MAIN"]);
  });

  it("answers none where there is no config to read", async () => {
    await expect(loadDatabases()).resolves.toEqual([]);
  });

  // Naming a file says you meant it, so a missing one is an error where an
  // absent acme.config.ts is not.
  it("names the file it could not read", async () => {
    const missing = at("nowhere.mjs");
    await expect(loadDatabases(missing)).rejects.toThrow(
      `could not read ${missing}`,
    );
  });
});

describe("databaseNamed", () => {
  it("finds a database by its binding", async () => {
    await expect(databaseNamed("RENAMED", KIT)).resolves.toMatchObject({
      binding: "RENAMED",
      urlVar: "RENAMED_DSN",
    });
  });

  it("names the declared bindings when asked for one that is not", async () => {
    await expect(databaseNamed("NOPE", KIT)).rejects.toThrow(
      /no database bound to NOPE: MAIN, ANALYTICS, RENAMED/u,
    );
  });
});
