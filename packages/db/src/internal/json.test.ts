import { createEmptyDialect } from "#testing/runtime";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { createDb } from "./database";
import { jsonText, parseJsonText } from "./json";

const VALUES = [
  ["a", "b"],
  { nested: { count: 1 } },
  [],
  null,
  42,
  "text",
  true,
];

interface TestSchema {
  documents: { id: string; body: string };
}

describe("jsonText and parseJsonText", () => {
  it("round-trip every value a JSON column can hold", () => {
    for (const value of VALUES) {
      expect(parseJsonText(jsonText(value))).toEqual(value);
    }
  });

  it("reject text that is not JSON, on parse", () => {
    expect(() => parseJsonText("not json")).toThrow(SyntaxError);
  });

  it("reject a circular value, on serialize", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => jsonText(circular)).toThrow(TypeError);
  });

  // TEXT on every engine: sqlite has no JSON column type, and one declared
  // `jsonb` there takes NUMERIC affinity, which would store 42 as an integer.
  it("survive a round-trip through a real column", async () => {
    const db = createDb<TestSchema>(await createEmptyDialect());
    await db.schema
      .createTable("documents")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("body", "text", (col) => col.notNull())
      .execute();

    await db
      .insertInto("documents")
      .values(
        VALUES.map((value, index) => ({
          id: `d${index}`,
          body: jsonText(value),
        })),
      )
      .execute();

    const rows = await db
      .selectFrom("documents")
      .select(["id", "body"])
      .orderBy("id")
      .execute();
    expect(rows).toHaveLength(VALUES.length);
    for (const [index, value] of VALUES.entries()) {
      const row = rows.find((candidate) => candidate.id === `d${index}`);
      expect(typeof row?.body).toBe("string");
      expect(parseJsonText(row?.body ?? "")).toEqual(value);
    }

    await sql`drop table documents`.execute(db);
    await db.destroy();
  });
});
