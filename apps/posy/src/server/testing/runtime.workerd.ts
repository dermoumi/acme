import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:test";
import { NO_MIGRATIONS } from "kysely/migration";
import { d1MigrationDialect } from "../../../scripts/d1-migration-dialect";
import { createDb, createMigrator } from "../db";
import type { GateBindings } from "../gate";
import type {
  CreateBindings,
  CreateEmptyDb,
  CreateEmptyDialect,
} from "./contract";

export const createBindings: CreateBindings = (overrides = {}) => ({
  ASSETS: env.ASSETS as GateBindings["ASSETS"],
  ...overrides,
});

// The pool has no isolatedStorage, so every test shares one D1 instance;
// reverting every migration is what makes the schema empty again.
export const createEmptyDialect: CreateEmptyDialect = async () => {
  const dialect = d1MigrationDialect(env.DB as D1Database);
  const { error } = await createMigrator(createDb(dialect)).migrateTo(
    NO_MIGRATIONS,
  );
  if (error) throw new Error("could not reset the D1 schema", { cause: error });
  return dialect;
};

export const createEmptyDb: CreateEmptyDb = async () =>
  createDb(await createEmptyDialect());
