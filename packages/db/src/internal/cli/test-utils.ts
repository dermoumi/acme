import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, vi } from "vitest";
import { createDb } from "../database";
import { dialectFromUrl } from "../uri/uri.node.ts";

export interface CliContext {
  dir: string;
  main: string;
  analytics: string;
}

/** The tables a database holds, less the migrator's own bookkeeping. */
export async function tables(url: string): Promise<string[]> {
  const db = createDb<never>(await dialectFromUrl(url));
  const found = await db.introspection.getTables();
  await db.destroy();

  return found
    .map((table) => table.name)
    .filter((name) => !name.includes("migration"))
    .toSorted();
}

/** Every row of a table, for checking what a seed put there. */
export async function rows(url: string, table: string): Promise<unknown[]> {
  const db = createDb<never>(await dialectFromUrl(url));
  const found = await db.selectFrom(table).selectAll().execute();
  await db.destroy();

  return found;
}

/** A hook reaches only its own describe, so every block installs this. */
export const sandbox = () => {
  // Files, not :memory:, which is private to the connection that opened it.
  beforeEach<CliContext>(async (ctx) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const dir = await mkdtemp(path.join(tmpdir(), "acme-db-cli-"));
    const main = `file:${path.join(dir, "main.db")}`;
    const analytics = `file:${path.join(dir, "analytics.db")}`;
    vi.stubEnv("MAIN_URL", main);
    vi.stubEnv("ANALYTICS_URL", analytics);

    ctx.dir = dir;
    ctx.main = main;
    ctx.analytics = analytics;
  });

  afterEach<CliContext>(async ({ dir }) => {
    await rm(dir, { recursive: true, force: true });
  });
};
