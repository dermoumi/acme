import type { D1Database } from "@cloudflare/workers-types";
import type { Dialect } from "kysely";
import * as v from "valibot";
import { d1MigrationDialect } from "./migration-dialect";

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

// Loose because the fields are Cloudflare's to add and `meta` is handed on as
// it arrived; nullish because a failed query answers `result: null`.
const QueryResponse = v.looseObject({
  success: v.boolean(),
  errors: v.nullish(
    v.array(v.looseObject({ code: v.number(), message: v.string() })),
  ),
  result: v.nullish(
    v.array(
      v.looseObject({
        results: v.array(v.record(v.string(), v.unknown())),
        meta: v.looseObject({
          changes: v.number(),
          last_row_id: v.nullable(v.number()),
        }),
      }),
    ),
  ),
});

type QueryResponse = v.InferOutput<typeof QueryResponse>;

// An edge 5xx answers HTML, and a body that parses but drifted from the shape
// is no more usable: both come back as a problem for the caller to blame.
async function readBody(
  response: Response,
): Promise<{ body?: QueryResponse; problem?: unknown }> {
  try {
    const payload = await response.json();
    const parsed = v.safeParse(QueryResponse, payload);

    return parsed.success
      ? { body: parsed.output }
      : { problem: new Error(v.summarize(parsed.issues)) };
  } catch (problem) {
    return { problem };
  }
}

/** Which remote database to reach, and the credentials to reach it with. */
export interface RemoteD1Config {
  accountId: string;
  apiToken: string;
  databaseId: string;
}

/**
 * A `D1Database` backed by Cloudflare's HTTP API, not a Worker binding.
 *
 * For migrating a remote database from a plain node process where no binding
 * exists: CI, or an operator's machine. It implements only
 * `prepare().bind().all()`, the entire surface `kysely-d1` uses, and claims the
 * full type on that basis. Every other method is absent, so this is migration
 * plumbing rather than a general remote D1 client.
 */
export function restD1(config: RemoteD1Config): D1Database {
  const url = `${CLOUDFLARE_API}/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;
  const shim = {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        all: async () => {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              authorization: `Bearer ${config.apiToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ sql, params }),
          });
          const { body, problem } = await readBody(response);

          if (!response.ok || !body?.success) {
            const detail = body?.errors
              ?.map((err) => `${err.code}: ${err.message}`)
              .join("; ");
            const message =
              detail ?? `D1 query failed with status ${response.status}`;
            throw new Error(message, { cause: problem });
          }
          const [first] = body.result ?? [];
          return {
            results: first?.results ?? [],
            meta: first?.meta ?? { changes: 0, last_row_id: null },
          };
        },
      }),
    }),
  };
  return shim as unknown as D1Database;
}

/**
 * The dialect to migrate a remote D1 with, over the HTTP API.
 *
 * Carries the names-only introspector {@link d1MigrationDialect} adds, which
 * the Migrator needs on D1 whatever transport reaches the database.
 */
export function remoteD1Dialect(config: RemoteD1Config): Dialect {
  return d1MigrationDialect(restD1(config));
}
