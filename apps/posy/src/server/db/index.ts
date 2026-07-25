import { type Dialect, Kysely } from "kysely";
import type { Database } from "./schema";

export function createDb(dialect: Dialect): Kysely<Database> {
  return new Kysely<Database>({ dialect });
}

// JSON columns are stored as TEXT; serialize on write, parse on read.
export function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

export function parseJsonText(text: string): unknown {
  return JSON.parse(text);
}

export { createMigrator } from "./migrator";
export type { Database } from "./schema";
