import { describe, expect, it } from "vitest";
import mainMigrations from "../kit/fixtures/app/migrations/main";
import { loadMigrations, loadSeed, type Resolve } from "./load";

// What the CLI hands a kit: the app's config is the base, because that is what
// the app wrote its specifiers relative to.
const CONFIG_URL = new URL(
  "../kit/fixtures/app/acme.config.ts",
  import.meta.url,
).href;
const resolve: Resolve = (specifier) => new URL(specifier, CONFIG_URL).href;

describe("loadMigrations", () => {
  it("imports what the specifier default-exports", async () => {
    await expect(
      loadMigrations(
        { binding: "MAIN", migrations: "./migrations/main.ts" },
        resolve,
      ),
    ).resolves.toEqual(mainMigrations);
  });

  it("answers an empty record when the database declares none", async () => {
    await expect(loadMigrations({ binding: "MAIN" }, resolve)).resolves.toEqual(
      {},
    );
  });

  it("names the database whose module cannot be loaded", async () => {
    await expect(
      loadMigrations({ binding: "MAIN", migrations: "./nowhere.ts" }, resolve),
    ).rejects.toThrow(/MAIN's migrations module cannot be loaded/u);
  });

  it("says so when the module exports nothing as default", async () => {
    await expect(
      loadMigrations(
        { binding: "MAIN", migrations: "./no-default.ts" },
        resolve,
      ),
    ).rejects.toThrow(/MAIN's migrations module must export it as default/u);
  });
});

describe("loadSeed", () => {
  it("imports what the specifier default-exports", async () => {
    await expect(
      loadSeed({ binding: "MAIN", seed: "./seed.ts" }, resolve),
    ).resolves.toBeTypeOf("function");
  });

  it("answers nothing when the database declares none", async () => {
    await expect(
      loadSeed({ binding: "MAIN" }, resolve),
    ).resolves.toBeUndefined();
  });

  it("says so when the module exports nothing as default", async () => {
    await expect(
      loadSeed({ binding: "MAIN", seed: "./no-default.ts" }, resolve),
    ).rejects.toThrow(/MAIN's seed module must export it as default/u);
  });
});
