/// <reference types="@acme/app/types" />

import type { AcmeConfig } from "@acme/app";
import virtualConfig from "virtual:acme-config";
import type { Kysely } from "kysely";
import type { DatabaseConfig } from "../internal/kit";
import {
  type Accessors,
  buildGetDb,
  type Databases,
} from "../internal/kit/get-db";
import { type DatabaseContext, KIT_NAME } from "../internal/kit/kit";
import { emptyDbEnv } from "./empty-env";

/**
 * The database kit a config declared, resolved to what it holds.
 */
export interface DbKit {
  accessors: Accessors;
  databases: DatabaseConfig[];
}

export function kitOf(config: AcmeConfig): DbKit {
  const kit = (config.kits ?? []).find((declared) => {
    return declared.name === KIT_NAME;
  });
  if (!kit?.context) {
    throw new Error("no database kit is declared in this config");
  }

  return {
    accessors: (kit.context as DatabaseContext).accessors,
    databases: kit.config as DatabaseConfig[],
  };
}

/**
 * What {@link getTestDb} takes beyond the binding.
 */
export interface TestDbOptions {
  /**
   * The app's own, taken from `virtual:acme-config` unless one is passed.
   * Pass one to open a database a test declared rather than the app's.
   */
  config?: AcmeConfig;
  /**
   * What the app would have been handed for this request. Pass one to share a
   * database with a handler; omitting it EMPTIES the database first.
   */
  env?: unknown;
}

/**
 * Opens a database the app declared, with no request in hand.
 *
 * ```ts
 * const db = await getTestDb("DATABASE");
 * ```
 *
 * The same connection `ctx.var.getDb` hands a route, so a case and a handler
 * share one database rather than two empty ones.
 *
 * @throws If the config declares no database kit.
 */
export async function getTestDb<Name extends keyof Databases>(
  name: Name,
  { config = virtualConfig, env }: TestDbOptions = {},
): Promise<Kysely<Databases[Name]>> {
  const { accessors, databases } = kitOf(config);
  const urlVar = databases.find((entry) => {
    return entry.binding === name;
  })?.urlVar;

  return buildGetDb(
    accessors,
    env ?? (await emptyDbEnv(name, { urlVar })),
  )(name);
}
