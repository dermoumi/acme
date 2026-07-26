import type { D1Database } from "@cloudflare/workers-types";
import { createInterface } from "node:readline";
import { D1Dialect } from "kysely-d1";
import { getPlatformProxy } from "wrangler";
import { hashPassword } from "../src/server/auth";
import type { AppBindings } from "../src/server/bindings";
import { createDb } from "../src/server/db";
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

async function readPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question("password: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function setLocal(userId: string, hash: string): Promise<void> {
  const { env, dispose } = await getPlatformProxy<AppBindings>();
  if (!env.DB) throw new Error("no DB binding in wrangler config");
  const db = createDb(new D1Dialect({ database: env.DB }));
  await db
    .insertInto("users")
    .values({
      id: userId,
      name: userId,
      password_hash: hash,
      created_at: Date.now(),
    })
    .onConflict((oc) => oc.column("id").doUpdateSet({ password_hash: hash }))
    .execute();
  await db.destroy();
  await dispose();
}

async function setRemote(
  userId: string,
  hash: string,
  dbId: string,
): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set",
    );
  }
  const db = createDb(d1MigrationDialect(restD1(accountId, apiToken, dbId)));
  await db
    .updateTable("users")
    .set({ password_hash: hash })
    .where("id", "=", userId)
    .execute();
  await db.destroy();
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const [username, target] = args;

if (username) {
  const password = await readPassword();
  if (password) {
    const hash = await hashPassword(password);
    if (target) {
      await setRemote(username, hash, target);
    } else {
      await setLocal(username, hash);
    }
    console.log(`password set for ${username}`);
  } else {
    console.error("password must be provided on stdin");
    process.exitCode = 1;
  }
} else {
  console.error("usage: pnpm set-password -- <username> [database-id]");
  console.error("  omit database-id for local D1, provide it for remote");
  process.exitCode = 1;
}
