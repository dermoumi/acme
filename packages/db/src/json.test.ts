import { describe, expect, it } from "vitest";
import { jsonText, parseJsonText } from "./json";

describe("json columns", () => {
  it("round-trips values a JSON column can hold", () => {
    const values = [
      ["a", "b"],
      { nested: { count: 1 } },
      [],
      null,
      42,
      "text",
      true,
    ];
    for (const value of values) {
      expect(parseJsonText(jsonText(value))).toEqual(value);
    }
  });

  it("rejects text that is not JSON on parse", () => {
    expect(() => parseJsonText("not json")).toThrow(SyntaxError);
  });

  it("rejects a circular value on serialize", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => jsonText(circular)).toThrow(TypeError);
  });
});
