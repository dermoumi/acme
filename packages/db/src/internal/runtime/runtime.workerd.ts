import type { D1Database } from "@cloudflare/workers-types";
import { d1MigrationDialect } from "../../d1";
import type { ResolveDialect } from "./contract";

export const resolveDialect: ResolveDialect = (env, binding) => {
  const database = (env as Record<string, unknown>)[binding];
  if (!database) {
    throw new Error(`no D1 binding named "${binding}" on this environment`);
  }

  return Promise.resolve(d1MigrationDialect(database as D1Database));
};
