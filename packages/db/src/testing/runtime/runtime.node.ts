import SQLite from "better-sqlite3";
import { SqliteDialect } from "kysely";
import type { CreateEmptyDialect } from "./contract";

// A private in-memory database is empty by construction.
export const createEmptyDialect: CreateEmptyDialect = () =>
  Promise.resolve(new SqliteDialect({ database: new SQLite(":memory:") }));
