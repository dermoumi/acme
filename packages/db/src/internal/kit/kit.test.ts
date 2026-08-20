import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDbAccessors } from "../db";
import { databaseKit } from "./kit";

// Spied, not replaced: all this needs to know is when it happens.
vi.mock("../db", { spy: true });

describe("databaseKit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names itself by its specifier, so a reader can find it back", () => {
    expect(databaseKit([{ binding: "MAIN" }])).toMatchObject({
      name: "@acme/db",
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

  // The vite plugin reads acme.config.ts on a build machine, so a declared kit
  // that opened anything would be opening it there.
  it("opens nothing until something builds it", () => {
    const kit = databaseKit([{ binding: "MAIN" }]);
    expect(openDbAccessors).not.toHaveBeenCalled();

    kit.init?.();

    expect(openDbAccessors).toHaveBeenCalledOnce();
  });

  // Nothing else memoizes it, so a second reader of one declaration would
  // otherwise land on a second set of connections.
  it("opens one declaration's databases once, however often it is built", () => {
    const kit = databaseKit([{ binding: "MAIN" }]);

    kit.init?.();
    kit.init?.();

    expect(openDbAccessors).toHaveBeenCalledOnce();
  });

  it("puts a getDb on every request it reaches", () => {
    const { vars } = databaseKit([{ binding: "MAIN" }]).init?.() ?? {};

    expect(vars?.({})).toHaveProperty("getDb", expect.any(Function));
  });

  it("declares where its commands live, for the CLI to resolve", () => {
    expect(databaseKit([]).commands).toBe("@acme/db/commands");
  });
});
