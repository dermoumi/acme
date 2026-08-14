import { describe, expect, it } from "vitest";
import appConfig from "./fixtures/app/acme.config";
import { KIT_NAME, database, databasesOf } from "./kit";

describe("database", () => {
  it("names itself so a reader can find it back", () => {
    expect(database([{ binding: "MAIN" }])).toMatchObject({ name: KIT_NAME });
  });

  it("carries every database it was given, in order", () => {
    const declared = [{ binding: "MAIN" }, { binding: "ANALYTICS" }];
    expect(database(declared).config).toEqual(declared);
  });

  it("takes an app that declares no database at all", () => {
    expect(database([]).config).toEqual([]);
  });

  it("rejects a binding declared twice", () => {
    expect(() =>
      database([
        { binding: "SAME" },
        { binding: "OTHER" },
        { binding: "SAME" },
      ]),
    ).toThrow(/database kit declares SAME twice/u);
  });

  // The commands are node-only, so the kit names them by URL rather than
  // importing them; a wrong base would resolve inside whoever called us.
  it("points at its own commands, not its caller's", () => {
    expect(database([]).cli).toMatch(/\/db\/src\/cli\/commands\.ts$/u);
  });
});

describe("databasesOf", () => {
  it("reads what the app declared through the kit", () => {
    expect(databasesOf(appConfig).map((entry) => entry.binding)).toEqual([
      "MAIN",
      "ANALYTICS",
      "RENAMED",
    ]);
  });

  it("answers none for an app that took no database kit", () => {
    expect(databasesOf({ kits: [{ name: "greeter" }] })).toEqual([]);
  });

  it("answers none for an app that declared no kits", () => {
    expect(databasesOf({})).toEqual([]);
  });
});
