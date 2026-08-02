import { expect, test } from "vitest";
import { jsonText, parseJsonText } from "./json";

test("round-trips values a JSON column can hold", () => {
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

test("parse rejects text that is not JSON", () => {
  expect(() => parseJsonText("not json")).toThrow(SyntaxError);
});

test("serialize rejects a circular value", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  expect(() => jsonText(circular)).toThrow(TypeError);
});
