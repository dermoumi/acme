import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PostgresDialect, SqliteDialect, sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../database";
import {
  dialectFromUrl,
  explainIfMissing,
  toDatabasePath,
} from "./uri.node.ts";

describe("toDatabasePath", () => {
  // Pure string work: these paths are never created, only converted.
  const dir = path.join(tmpdir(), "acme-db-never-created");

  it("takes the WHATWG file url form", () => {
    const file = path.join(dir, "whatwg.db");
    expect(toDatabasePath(pathToFileURL(file).href)).toBe(file);
  });

  it("takes the relaxed relative form", () => {
    expect(toDatabasePath("file:relative.db")).toBe("relative.db");
    expect(toDatabasePath("file:/abs/path.db")).toBe("/abs/path.db");
  });

  it("answers :memory: in both spellings", () => {
    expect(toDatabasePath(":memory:")).toBe(":memory:");
    expect(toDatabasePath("file::memory:")).toBe(":memory:");
  });

  // A plain slice would leave the escape in place and open the wrong file.
  it("decodes percent-escapes in a file url", () => {
    const file = path.join(dir, "with space.db");
    expect(pathToFileURL(file).href).toContain("%20");
    expect(toDatabasePath(pathToFileURL(file).href)).toBe(file);
  });

  it("refuses a url that is not sqlite", () => {
    expect(() => toDatabasePath("postgres://host/db")).toThrow(
      /not a sqlite url/u,
    );
  });

  it("names the scheme without echoing a url that carries a password", () => {
    const url = "postgres://admin:hunter2@db.internal:5432/app";
    let message = "";
    try {
      toDatabasePath(url);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('"postgres:..."');
    expect(message).not.toContain("hunter2");
    expect(message).not.toContain(url);
  });
});

describe("dialectFromUrl", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "acme-db-"));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("opens sqlite for :memory:", async () => {
    expect(await dialectFromUrl(":memory:")).toBeInstanceOf(SqliteDialect);
  });

  it("opens sqlite for a file url, and actually writes", async () => {
    const file = path.join(dir, "written.db");
    const db = createDb(await dialectFromUrl(pathToFileURL(file).href));
    await sql`create table t (id text)`.execute(db);
    await sql`insert into t values ('x')`.execute(db);
    const rows = await sql<{ id: string }>`select id from t`.execute(db);
    expect(rows.rows).toEqual([{ id: "x" }]);
    await db.destroy();
  });

  // pg connects lazily, so this reaches the driver without needing a server.
  it("opens postgres for both postgres: and postgresql:", async () => {
    const base = "//user@127.0.0.1:1/none";
    expect(await dialectFromUrl(`postgres:${base}`)).toBeInstanceOf(
      PostgresDialect,
    );
    expect(await dialectFromUrl(`postgresql:${base}`)).toBeInstanceOf(
      PostgresDialect,
    );
  });

  it("refuses an unsupported scheme by name", async () => {
    await expect(dialectFromUrl("mysql://localhost/db")).rejects.toThrow(
      /unsupported database url/u,
    );
  });

  // The throw reaches Sentry through the app's error handler, and CI logs
  // through the CLI, so the url itself must not travel with it.
  it("never puts the url in the message", async () => {
    const url = "mysql://admin:hunter2@db.internal:3306/app";
    let message = "";
    try {
      await dialectFromUrl(url);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('"mysql:..."');
    expect(message).not.toContain("hunter2");
    expect(message).not.toContain("admin");
    expect(message).not.toContain(url);
  });

  // Nothing listens on port 1, so this needs no server of its own.
  it("surfaces an unreachable postgres on the first query", async () => {
    const db = createDb(await dialectFromUrl("postgres://no@127.0.0.1:1/none"));
    await expect(sql`select 1`.execute(db)).rejects.toThrow();
    await db.destroy();
  });
});

describe("explainIfMissing", () => {
  function notFound(code: string, message = "Cannot find package 'pg'") {
    return Object.assign(new Error(message), { code });
  }

  it("hands back what the import resolved to", async () => {
    const module = { default: "driver" };
    await expect(explainIfMissing("pg", Promise.resolve(module))).resolves.toBe(
      module,
    );
  });

  // node reports the first from esm and the second from cjs.
  it.each(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"])(
    "names the package to install when the import fails with %s",
    async (code) => {
      await expect(
        explainIfMissing("pg", Promise.reject(notFound(code))),
      ).rejects.toThrow(/@acme\/db needs the "pg" package/u);
    },
  );

  it("keeps the original as the cause", async () => {
    const cause = notFound("ERR_MODULE_NOT_FOUND");

    let thrown: Error | undefined;
    try {
      await explainIfMissing("pg", Promise.reject(cause));
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.cause).toBe(cause);
  });

  // An installed driver that throws on load must not be blamed on the install.
  it("rethrows a failure that is not a missing module", async () => {
    const boom = notFound("ERR_INVALID_ARG_TYPE", "bad option");

    await expect(explainIfMissing("pg", Promise.reject(boom))).rejects.toThrow(
      "bad option",
    );
  });

  it("rethrows a failure carrying no code at all", async () => {
    await expect(
      explainIfMissing("pg", Promise.reject(new Error("plain"))),
    ).rejects.toThrow("plain");
  });
});
