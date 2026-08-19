import { describe, expect, it } from "vitest";
import { databaseKit } from "./kit";

describe("databaseKit", () => {
  it("names itself so a reader can find it back", () => {
    expect(databaseKit([{ binding: "MAIN" }])).toMatchObject({
      name: "database",
    });
  });

  it("carries every database it was given, in order", () => {
    const declared = [{ binding: "MAIN" }, { binding: "ANALYTICS" }];
    expect(databaseKit(declared).config).toEqual(declared);
  });

  it("takes an app that declares no database at all", () => {
    expect(databaseKit([]).config).toEqual([]);
  });

  it("rejects a binding declared twice", () => {
    expect(() =>
      databaseKit([
        { binding: "SAME" },
        { binding: "OTHER" },
        { binding: "SAME" },
      ]),
    ).toThrow(/SAME is declared more than once/u);
  });

  // Named by URL, not imported: a wrong base resolves inside the caller.
  it("points at its own commands, not its caller's", () => {
    const { commands } = databaseKit([]);

    expect(commands?.()).toMatch(
      /\/db\/src\/internal\/commands\/commands\.ts$/u,
    );
  });

  // import.meta.url is no URL in a worker, so building one throws at startup.
  it("defers building that url until something asks for it", () => {
    expect(databaseKit([]).commands).toBeTypeOf("function");
  });
});
