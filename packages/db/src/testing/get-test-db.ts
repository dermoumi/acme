/// <reference types="@acme/app/types" />

import type { AcmeConfig } from "@acme/app";
import virtualConfig from "virtual:acme-config";
import type { Kysely } from "kysely";
import type { DatabaseConfig } from "../internal/kit";
import { type Accessors, buildGetDb, type Databases } from "../internal/db";
import { contextFor } from "../internal/kit/context";
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
    return declared.name === "@acme/db";
  });
  if (!kit) {
    throw new Error("no database kit is declared in this config");
  }

  // A name is all that says a kit is this one, and an app writes its own.
  if (!Array.isArray(kit.config)) {
    const message = 'what this config declares as "@acme/db" is not this kit';
    throw new Error(message);
  }

  const databases = kit.config as DatabaseConfig[];
  const { accessors } = contextFor(databases);

  return { accessors, databases };
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
  const { urlVar } = databases.find((entry) => entry.binding === name) ?? {};
  const dbEnv = env ?? (await emptyDbEnv(name, { urlVar }));

  return buildGetDb(accessors, dbEnv)(name);
}
