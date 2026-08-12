import type { D1Database } from "@cloudflare/workers-types";
import { D1Dialect } from "kysely-d1";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../internal/database";
import { type RemoteD1Config, remoteD1Dialect, restD1 } from "./rest";

interface TestSchema {
  widgets: { id: string };
}

const config: RemoteD1Config = {
  accountId: "acc",
  apiToken: "token",
  databaseId: "dbid",
};

interface Call {
  url: string;
  headers: Record<string, string>;
  body: { sql: string; params: unknown[] };
}

function mockFetch(
  payload: unknown,
  response: {
    ok?: boolean;
    status?: number;
    // Overridden to answer a body that is not json at all.
    json?: () => Promise<unknown>;
  } = {},
): Call[] {
  const calls: Call[] = [];
  // Typed to what restD1 sends, not RequestInit's wider union.
  interface SentInit {
    headers: Record<string, string>;
    body: string;
  }
  vi.stubGlobal("fetch", (url: string, init: SentInit) => {
    calls.push({
      url,
      headers: init.headers,
      body: JSON.parse(init.body) as Call["body"],
    });
    return Promise.resolve({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: response.json ?? (() => Promise.resolve(payload)),
    } as Response);
  });
  return calls;
}

function rowsPayload(rows: Record<string, unknown>[]) {
  return {
    success: true,
    result: [{ results: rows, meta: { changes: 0, last_row_id: null } }],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("restD1", () => {
  it("posts the sql and its parameters to the database's query url", async () => {
    const calls = mockFetch(rowsPayload([]));
    await restD1(config).prepare("select ?").bind(7).all();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acc/d1/database/dbid/query",
    );
    expect(calls[0]?.body).toEqual({ sql: "select ?", params: [7] });
  });

  it("authenticates with the api token as a bearer", async () => {
    const calls = mockFetch(rowsPayload([]));
    await restD1(config).prepare("select 1").bind().all();

    expect(calls[0]?.headers.authorization).toBe("Bearer token");
  });

  it("returns the rows and meta the api reported", async () => {
    mockFetch({
      success: true,
      result: [
        {
          results: [{ id: "w1" }],
          meta: { changes: 2, last_row_id: 9 },
        },
      ],
    });
    const result = await restD1(config).prepare("select 1").bind().all();

    expect(result.results).toEqual([{ id: "w1" }]);
    expect(result.meta).toEqual({ changes: 2, last_row_id: 9 });
  });

  it("defaults rows and meta when the api returns neither", async () => {
    mockFetch({ success: true });
    const result = await restD1(config).prepare("select 1").bind().all();

    expect(result.results).toEqual([]);
    expect(result.meta).toEqual({ changes: 0, last_row_id: null });
  });

  describe("surfaces failures rather than returning empty rows", () => {
    it("reports the api's own error detail", async () => {
      mockFetch({
        success: false,
        errors: [{ code: 7500, message: "no such table: widgets" }],
      });
      await expect(
        restD1(config).prepare("select 1").bind().all(),
      ).rejects.toThrow("7500: no such table: widgets");
    });

    // How a failure actually arrives: rejecting the body throws the detail away.
    it("reports the detail when result comes back null", async () => {
      mockFetch(
        {
          success: false,
          result: null,
          errors: [{ code: 7003, message: "could not route" }],
        },
        { ok: false, status: 404 },
      );
      await expect(
        restD1(config).prepare("select 1").bind().all(),
      ).rejects.toThrow("7003: could not route");
    });

    it("joins several errors into one message", async () => {
      mockFetch({
        success: false,
        errors: [
          { code: 1, message: "first" },
          { code: 2, message: "second" },
        ],
      });
      await expect(
        restD1(config).prepare("select 1").bind().all(),
      ).rejects.toThrow("1: first; 2: second");
    });

    it("falls back to the http status when the body names no error", async () => {
      mockFetch({ success: false }, { ok: false, status: 403 });
      await expect(
        restD1(config).prepare("select 1").bind().all(),
      ).rejects.toThrow("D1 query failed with status 403");
    });

    // An edge 5xx answers HTML, so parsing first would replace the status
    // with whatever the json parser complains about.
    it("keeps the http status when the body is not json at all", async () => {
      mockFetch(undefined, {
        ok: false,
        status: 502,
        json: () => Promise.reject(new SyntaxError("Unexpected token '<'")),
      });

      let thrown: Error | undefined;
      try {
        await restD1(config).prepare("select 1").bind().all();
      } catch (error) {
        thrown = error as Error;
      }

      expect(thrown?.message).toContain("D1 query failed with status 502");
      // Kept rather than swallowed: the CLI prints the chain, so why the body
      // would not parse is still there to debug with.
      expect((thrown?.cause as Error | undefined)?.message).toContain(
        "Unexpected token",
      );
    });

    it("refuses a body that parses but is not the shape we read", async () => {
      mockFetch({ success: true, result: [{ results: "not rows" }] });

      let thrown: Error | undefined;
      try {
        await restD1(config).prepare("select 1").bind().all();
      } catch (error) {
        thrown = error as Error;
      }

      expect(thrown?.message).toContain("D1 query failed with status 200");
      expect((thrown?.cause as Error | undefined)?.message).toContain(
        "result.0.results",
      );
    });
  });
});

describe("the body it accepts", () => {
  it("passes meta on with the fields cloudflare adds to it", async () => {
    mockFetch({
      success: true,
      result: [
        {
          results: [],
          meta: { changes: 0, last_row_id: null, duration: 0.3, rows_read: 7 },
        },
      ],
    });
    const result = await restD1(config).prepare("select 1").bind().all();

    expect(result.meta).toMatchObject({ duration: 0.3, rows_read: 7 });
  });
});

describe("remoteD1Dialect", () => {
  it("runs a kysely query end to end over the api", async () => {
    const calls = mockFetch(rowsPayload([{ id: "w1" }]));
    const db = createDb<TestSchema>(remoteD1Dialect(config));
    const rows = await db.selectFrom("widgets").selectAll().execute();

    expect(rows).toEqual([{ id: "w1" }]);
    expect(calls[0]?.body).toMatchObject({ sql: 'select * from "widgets"' });
  });

  it("introspects names only, as the Migrator needs on D1", async () => {
    mockFetch(rowsPayload([{ name: "widgets" }]));
    const db = createDb<TestSchema>(remoteD1Dialect(config));

    expect(await db.introspection.getTables()).toEqual([
      { name: "widgets", isView: false, isForeign: false, columns: [] },
    ]);
  });
});

// restD1 claims the whole D1Database type while implementing three methods,
// which holds only while kysely-d1 confines itself to them. Assert it directly.
describe("the surface restD1 has to implement", () => {
  it("is only prepare, bind and all", async () => {
    const touched = new Set<string>();
    const watch = <Target extends object>(target: Target): Target =>
      new Proxy(target, {
        get(object, property, receiver) {
          if (typeof property === "string") touched.add(property);
          return Reflect.get(object, property, receiver);
        },
      });

    const database = watch({
      prepare: () =>
        watch({
          bind: () =>
            watch({
              all: () =>
                Promise.resolve({
                  results: [],
                  meta: { changes: 0, last_row_id: null },
                }),
            }),
        }),
    });

    const db = createDb<TestSchema>(
      new D1Dialect({ database: database as unknown as D1Database }),
    );
    await db.selectFrom("widgets").selectAll().execute();
    await db.insertInto("widgets").values({ id: "w1" }).execute();

    // `then` is the await machinery probing for a thenable, not a D1 call.
    touched.delete("then");
    expect([...touched].toSorted()).toEqual(["all", "bind", "prepare"]);
  });
});
