import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PostgresDialect, SqliteDialect, sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../database";
import { dialectFromUrl, toDatabasePath } from "./uri.node";

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

  // Nothing listens on port 1, so this needs no server of its own.
  it("surfaces an unreachable postgres on the first query", async () => {
    const db = createDb(await dialectFromUrl("postgres://no@127.0.0.1:1/none"));
    await expect(sql`select 1`.execute(db)).rejects.toThrow();
    await db.destroy();
  });
});
