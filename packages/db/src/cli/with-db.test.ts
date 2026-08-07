import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withDb } from "./with-db";

const app = path.join(import.meta.dirname, "fixtures", "app");

describe("withDb", () => {
  let dir = "";
  let url = "";

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "acme-db-open-"));
    url = `file:${path.join(dir, "main.db")}`;
    vi.stubEnv("MAIN_URL", url);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("opens the database the url env var names", async () => {
    let opened: Kysely<never> | undefined;
    await withDb<never>("MAIN", { cwd: app }, async (db) => {
      opened = db;
      await db.schema.createTable("proof").addColumn("id", "text").execute();
    });

    expect(opened).toBeDefined();
    // Closed afterwards, so the same handle can no longer be used.
    await expect(
      opened?.selectFrom("proof").selectAll().execute(),
    ).rejects.toThrow();
  });

  it("takes the url var the config renames it to", async () => {
    vi.stubEnv("MAIN_URL", "");
    vi.stubEnv("RENAMED_DSN", url);
    await expect(
      withDb<never>("RENAMED", { cwd: app }, () => Promise.resolve()),
    ).resolves.toBeUndefined();
  });

  // Reaching Cloudflare needs credentials, so failing on the missing one is
  // what proves the environment beat the url sitting right there.
  it("prefers a named wrangler environment over the url env var", async () => {
    vi.stubEnv("MAIN_ID", "an-id");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    await expect(
      withDb<never>("MAIN", { wranglerEnv: "production", cwd: app }, () =>
        Promise.resolve(),
      ),
    ).rejects.toThrow(/CLOUDFLARE_ACCOUNT_ID must be set/u);
  });

  it("stays local when no environment is named", async () => {
    vi.stubEnv("MAIN_ID", "an-id");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    await expect(
      withDb<never>("MAIN", { cwd: app }, () => Promise.resolve()),
    ).resolves.toBeUndefined();
  });

  it("refuses a binding the config does not declare", async () => {
    await expect(
      withDb<never>("NOPE", { cwd: app }, () => Promise.resolve()),
    ).rejects.toThrow(/no database bound to NOPE: MAIN, ANALYTICS, RENAMED/u);
  });
});
