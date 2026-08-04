import type { D1Database } from "@cloudflare/workers-types";
import { d1MigrationDialect } from "../d1";
import type { CreateDialectResolver } from "./contract";

// Not cached: the binding arrives on each request's env, and holding one past
// its request is the classic Workers bug. Wrapping it is cheap.
export const createDialectResolver: CreateDialectResolver =
  (options) => (env) => {
    const database = (env as Record<string, unknown>)[options.binding];
    if (!database) {
      throw new Error(
        `no D1 binding named "${options.binding}" on this environment`,
      );
    }

    return Promise.resolve(d1MigrationDialect(database as D1Database));
  };
