import type { Limiter } from "@acme/rate-limiter";
import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:test";
import { NO_MIGRATIONS } from "kysely/migration";
import { createDb } from "@acme/db";
import { d1MigrationDialect } from "@acme/db/d1";
import { createMigrator, type Database } from "../../db";
import type { GateBindings } from "../../gate";
import type {
  CreateBindings,
  CreateEmptyDb,
  CreateEmptyDialect,
} from "./contract";

// Real miniflare bindings, so this run exercises the platform limiter itself.
export const createBindings: CreateBindings = (overrides = {}) => ({
  ASSETS: env.ASSETS as GateBindings["ASSETS"],
  RATE_LIMIT_LOGIN: env.RATE_LIMIT_LOGIN as Limiter,
  RATE_LIMIT_SENTRY: env.RATE_LIMIT_SENTRY as Limiter,
  ...overrides,
});

// The pool has no isolatedStorage, so every test shares one D1 instance;
// reverting every migration is what makes the schema empty again.
export const createEmptyDialect: CreateEmptyDialect = async () => {
  const dialect = d1MigrationDialect(env.DB as D1Database);
  const { error } = await createMigrator(createDb<Database>(dialect)).migrateTo(
    NO_MIGRATIONS,
  );
  if (error) throw new Error("could not reset the D1 schema", { cause: error });
  return dialect;
};

export const createEmptyDb: CreateEmptyDb = async () => {
  return createDb<Database>(await createEmptyDialect());
};
