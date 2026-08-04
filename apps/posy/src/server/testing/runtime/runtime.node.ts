import SQLite from "better-sqlite3";
import { SqliteDialect } from "kysely";
import indexHtml from "../../../../test/fixtures/assets/index.html?raw";
import { createDb } from "@acme/db";
import type { Database } from "../../db";
import type { GateBindings } from "../../gate";
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

// No limiters: node builds its own from the policies createApp was given, so
// binding one here would override the thing under test.
export const createBindings: CreateBindings = (overrides = {}) => ({
  ASSETS: assets(),
  ...overrides,
});

// A private in-memory database is empty by construction.
export const createEmptyDialect: CreateEmptyDialect = () => {
  return Promise.resolve(
    new SqliteDialect({ database: new SQLite(":memory:") }),
  );
};

export const createEmptyDb: CreateEmptyDb = async () => {
  return createDb<Database>(await createEmptyDialect());
};
