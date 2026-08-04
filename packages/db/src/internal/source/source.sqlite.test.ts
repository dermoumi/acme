import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { createDbSource } from "./source";

describe("createDbSource over sqlite", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "acme-db-sqlite-"));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function fileUrl(name: string): string {
    return pathToFileURL(path.join(dir, name)).href;
  }

  // Guards anyone "optimising" the cache into a shared connection: two
  // :memory: databases are private, and losing that would silently share state.
  it("keeps two :memory: sources from seeing each other", async () => {
    const first = await createDbSource({ url: ":memory:" }).resolve();
    const second = await createDbSource({ url: ":memory:" }).resolve();

    await sql`create table only_in_first (id text)`.execute(first);
    await expect(
      sql`select 1 from only_in_first`.execute(second),
    ).rejects.toThrow();

    await first.destroy();
    await second.destroy();
  });

  it("lets two sources over one file url see each other's writes", async () => {
    const url = fileUrl("shared.db");
    const writer = await createDbSource({ url }).resolve();
    await sql`create table shared (id text)`.execute(writer);
    await sql`insert into shared values ('w1')`.execute(writer);

    const reader = await createDbSource({ url }).resolve();
    const rows = await sql<{ id: string }>`select id from shared`.execute(
      reader,
    );
    expect(rows.rows).toEqual([{ id: "w1" }]);

    await writer.destroy();
    await reader.destroy();
  });

  it("creates the database file when it does not exist", async () => {
    const file = path.join(dir, "created.db");
    expect(existsSync(file)).toBe(false);

    const db = await createDbSource({
      url: pathToFileURL(file).href,
    }).resolve();
    await sql`create table t (id text)`.execute(db);
    expect(existsSync(file)).toBe(true);
    await db.destroy();
  });

  // Asserting a retry, not just a second failure: a cached rejection would also
  // reject twice, so only a later success proves the cache was cleared.
  it("retries a failed connection rather than caching it", async () => {
    const nested = path.join(dir, "appears-later");
    const source = createDbSource({
      url: pathToFileURL(path.join(nested, "x.db")).href,
    });
    await expect(source.resolve()).rejects.toThrow();

    mkdirSync(nested, { recursive: true });
    expect(await source.resolve()).toBeDefined();
  });
});
