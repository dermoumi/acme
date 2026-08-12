import type { Dialect } from "kysely";
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from "kysely";
import { describe, expect, it } from "vitest";
import { type DialectKind, dialectKind, tagDialect } from "./kind";

const postgres = {
  createAdapter: () => new PostgresAdapter(),
  createDriver: () => new DummyDriver(),
  createIntrospector: (db: Kysely<never>) => new PostgresIntrospector(db),
  createQueryCompiler: () => new PostgresQueryCompiler(),
};

const sqlite = {
  createAdapter: () => new SqliteAdapter(),
  createDriver: () => new DummyDriver(),
  createIntrospector: (db: Kysely<never>) => new SqliteIntrospector(db),
  createQueryCompiler: () => new SqliteQueryCompiler(),
};

function kindOf(dialect: Dialect): DialectKind {
  return dialectKind(new Kysely<never>({ dialect }));
}

describe("dialectKind", () => {
  it("reads the tag a dialect was given", () => {
    // Deliberately crossed, so only the tag can produce this answer.
    expect(kindOf(tagDialect({ ...sqlite }, "postgres"))).toBe("postgres");
    expect(kindOf(tagDialect({ ...postgres }, "sqlite"))).toBe("sqlite");
  });

  it("refuses to guess when a dialect carries no tag", () => {
    // Never inferred from adapter capabilities: supportsTransactionalDdl would
    // read a future MySQL or MariaDB as postgres and emit DDL it rejects.
    expect(() => kindOf(postgres)).toThrow(/untagged/u);
    expect(() => kindOf(sqlite)).toThrow(/untagged/u);
  });

  it("returns the dialect it was given, still itself", () => {
    const dialect = { ...sqlite };
    const tagged = tagDialect(dialect, "postgres");

    expect(tagged).toBe(dialect);
    expect(tagged.createQueryCompiler()).toBeInstanceOf(SqliteQueryCompiler);
  });
});
