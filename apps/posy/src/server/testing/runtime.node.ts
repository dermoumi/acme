import SQLite from "better-sqlite3";
import { SqliteDialect } from "kysely";
import indexHtml from "../../../test/fixtures/assets/index.html?raw";
import { createDb } from "../db";
import type { GateBindings } from "../gate";
import { LOGIN_LIMIT, PERIOD_SECONDS, SENTRY_LIMIT } from "../rate-limit";
import { createMemoryLimiter } from "../rate-limit/runtime.node";
import type {
  CreateBindings,
  CreateEmptyDb,
  CreateEmptyDialect,
} from "./contract";

// workerd hands back binding responses with immutable headers; reproduce that
// here so the node run holds the worker to the same contract.
function reject(): never {
  throw new TypeError("Can't modify immutable headers.");
}

function seal(res: Response): Response {
  Object.defineProperties(res.headers, {
    set: { value: reject },
    append: { value: reject },
    delete: { value: reject },
  });
  return res;
}

// Matches the fixture's not_found_handling: every path serves index.html.
function assets(): GateBindings["ASSETS"] {
  return {
    fetch: () =>
      Promise.resolve(
        seal(
          new Response(indexHtml, {
            headers: { "Content-Type": "text/html" },
          }),
        ),
      ),
  };
}

// Fresh limiters per call, so a test gets a clean budget by building its own app.
export const createBindings: CreateBindings = (overrides = {}) => ({
  ASSETS: assets(),
  RATE_LIMIT_LOGIN: createMemoryLimiter({
    limit: LOGIN_LIMIT,
    windowMs: PERIOD_SECONDS * 1000,
  }),
  RATE_LIMIT_SENTRY: createMemoryLimiter({
    limit: SENTRY_LIMIT,
    windowMs: PERIOD_SECONDS * 1000,
  }),
  ...overrides,
});

// A private in-memory database is empty by construction.
export const createEmptyDialect: CreateEmptyDialect = () =>
  Promise.resolve(new SqliteDialect({ database: new SQLite(":memory:") }));

export const createEmptyDb: CreateEmptyDb = async () =>
  createDb(await createEmptyDialect());
