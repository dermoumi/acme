import type { D1Database } from "@cloudflare/workers-types";
import {
  type DatabaseIntrospector,
  type Dialect,
  type Kysely,
  sql,
  type TableMetadata,
} from "kysely";
import { D1Dialect } from "kysely-d1";
import { tagDialect } from "../dialect";

// D1 rejects the pragma_table_info() join in kysely's sqlite introspector
// (SQLITE_AUTH); the Migrator only needs table names, so read sqlite_master.
function d1TableIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
  const getTables = async (): Promise<TableMetadata[]> => {
    const result = await sql<{ name: string }>`
      select name from sqlite_master
      where type = 'table' and name not like 'sqlite_%'
    `.execute(db);
    return result.rows.map((row) => ({
      name: row.name,
      isView: false,
      isForeign: false,
      columns: [],
    }));
  };
  return {
    getSchemas: () => Promise.resolve([]),
    getTables,
  };
}

// D1's protected _cf_* tables make kysely's pragma_table_info() introspector
// throw SQLITE_AUTH (kysely#1571), so this reports names only, never columns.
export function d1MigrationDialect(database: D1Database): Dialect {
  const inner = new D1Dialect({ database });

  return tagDialect(
    {
      createAdapter: () => inner.createAdapter(),
      createDriver: () => inner.createDriver(),
      createQueryCompiler: () => inner.createQueryCompiler(),
      createIntrospector: (db) => d1TableIntrospector(db),
    },
    "sqlite",
  );
}
