import SQLite from "better-sqlite3";
import { type Dialect, SqliteDialect } from "kysely";

/**
 * Builds a Kysely dialect over a file-backed SQLite database, for node hosts.
 *
 * Creates the file if it does not exist, so migrations can run against a fresh
 * volume. Holds the handle open: call it once at startup, not per request.
 *
 * @param path Filesystem path to the database file.
 */
export function fileDialect(path: string): Dialect {
  return new SqliteDialect({ database: new SQLite(path) });
}
