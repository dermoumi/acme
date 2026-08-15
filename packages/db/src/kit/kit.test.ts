import { describe, expect, it } from "vitest";
import { database } from "./kit";

describe("database", () => {
  it("names itself so a reader can find it back", () => {
    expect(database([{ binding: "MAIN" }])).toMatchObject({ name: "database" });
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
    ).toThrow(/SAME is declared more than once/u);
  });

  // The commands are node-only, so the kit names them by URL rather than
  // importing them; a wrong base would resolve inside whoever called us.
  it("points at its own commands, not its caller's", () => {
    expect(database([]).cli).toMatch(/\/db\/src\/cli\/commands\.ts$/u);
  });
});
