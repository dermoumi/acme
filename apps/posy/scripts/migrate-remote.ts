import type { D1Database } from "@cloudflare/workers-types";
import { createDb, createMigrator } from "../src/server/db";
import { d1MigrationDialect } from "./d1-migration-dialect";

interface QueryResponse {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: {
    results: Record<string, unknown>[];
    meta: { changes: number; last_row_id: number | null };
  }[];
}

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

// Stand-in for the D1 binding backed by the REST API: kysely-d1 only calls
// prepare().bind().all(), so this is the whole surface it needs.
function restD1(
  accountId: string,
  apiToken: string,
  databaseId: string,
): D1Database {
  const url = `${CLOUDFLARE_API}/accounts/${accountId}/d1/database/${databaseId}/query`;
  const shim = {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        all: async () => {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              authorization: `Bearer ${apiToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ sql, params }),
          });
          const body = (await response.json()) as QueryResponse;
          if (!response.ok || !body.success) {
            const detail = body.errors
              ?.map((err) => `${err.code}: ${err.message}`)
              .join("; ");
            throw new Error(
              detail ?? `D1 query failed with status ${response.status}`,
            );
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

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const databaseId = process.argv[2];
if (!accountId || !apiToken) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set");
}
if (!databaseId) throw new Error("usage: migrate-remote.ts <database-id>");

const db = createDb(
  d1MigrationDialect(restD1(accountId, apiToken, databaseId)),
);
const { error, results } = await createMigrator(db).migrateToLatest();
for (const result of results ?? []) {
  console.log(`${result.status}: ${result.migrationName}`);
}
await db.destroy();

if (error) {
  console.error(error);
  process.exitCode = 1;
}
