import type { CreateTableBuilder, Kysely } from "kysely";
import { dialectKind } from "./kind";

/**
 * Adds a database-generated integer primary key, spelled for its dialect.
 *
 * Kysely's `autoIncrement()` covers sqlite and MySQL only, and postgres rejects
 * the `auto_increment` it emits; postgres wants `serial` instead. Passing this
 * to `$call` keeps one migration running on every engine the kit opens.
 *
 * ```ts
 * await db.schema
 *   .createTable("ledger")
 *   .$call(generatedId(db))
 *   .addColumn("user_id", "text", (col) => col.notNull())
 *   .execute();
 * ```
 *
 * The column is `Generated<number>` in the app's schema either way.
 *
 * @param db The handle the migration was given, which carries the dialect.
 * @param column Column name. Defaults to `id`.
 */
export function generatedId(db: Kysely<never>, column = "id") {
  return <Table extends string, Column extends string>(
    builder: CreateTableBuilder<Table, Column>,
  ): CreateTableBuilder<Table, Column> =>
    dialectKind(db) === "postgres"
      ? builder.addColumn(column, "serial", (col) => col.primaryKey())
      : builder.addColumn(column, "integer", (col) =>
          col.primaryKey().autoIncrement(),
        );
}
