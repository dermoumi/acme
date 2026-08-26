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

export interface RemoteD1Config {
  accountId: string;
  apiToken: string;
  databaseId: string;
}

// Implements only prepare().bind().all(), the whole surface kysely-d1 uses, and
// claims the full D1Database type on that basis. Migration plumbing only.
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

export function remoteD1Dialect(config: RemoteD1Config): Dialect {
  return d1MigrationDialect(restD1(config));
}
