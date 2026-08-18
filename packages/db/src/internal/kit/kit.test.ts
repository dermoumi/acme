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

  // The commands are node-only, so the kit names them by URL rather than
  // importing them; a wrong base would resolve inside whoever called us.
  it("points at its own commands, not its caller's", () => {
    expect(databaseKit([]).cli).toMatch(
      /\/db\/src\/internal\/commands\/commands\.ts$/u,
    );
  });
});
