import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withDb } from "./with-db";

const MAIN = { binding: "MAIN" };
const RENAMED = { binding: "RENAMED", urlVar: "RENAMED_DSN" };

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
    await withDb<never>(MAIN, {}, async (db) => {
      opened = db;
      await db.schema.createTable("proof").addColumn("id", "text").execute();
    });

    expect(opened).toBeDefined();
    // Closed afterwards, so the same handle can no longer be used.
    await expect(
      opened?.selectFrom("proof").selectAll().execute(),
    ).rejects.toThrow();
  });

  it("closes the database even when the callback throws", async () => {
    let opened: Kysely<never> | undefined;
    await expect(
      withDb<never>(MAIN, {}, async (db) => {
        opened = db;
        await db.schema.createTable("proof").addColumn("id", "text").execute();
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await expect(
      opened?.selectFrom("proof").selectAll().execute(),
    ).rejects.toThrow();
  });

  // A second destroy resolves, so nothing makes a real close fail on demand:
  // the handle's own is replaced with one that rejects.
  function breakClose(db: Kysely<never>): void {
    Object.defineProperty(db, "destroy", {
      value: () => Promise.reject(new Error("close exploded")),
    });
  }

  it("keeps the caller's error when closing fails too", async () => {
    await expect(
      withDb<never>(MAIN, {}, (db) => {
        breakClose(db);
        return Promise.reject(new Error("what the caller hit"));
      }),
    ).rejects.toThrow("what the caller hit");
  });

  it("surfaces a closing failure when the caller had none", async () => {
    await expect(
      withDb<never>(MAIN, {}, (db) => {
        breakClose(db);
        return Promise.resolve();
      }),
    ).rejects.toThrow("close exploded");
  });

  it("takes the url var the config renames it to", async () => {
    vi.stubEnv("MAIN_URL", "");
    vi.stubEnv("RENAMED_DSN", url);
    await expect(
      withDb<never>(RENAMED, {}, () => Promise.resolve()),
    ).resolves.toBeUndefined();
  });

  // Reaching Cloudflare needs credentials, so failing on the missing one is
  // what proves the environment beat the url sitting right there.
  it("prefers a named wrangler environment over the url env var", async () => {
    vi.stubEnv("MAIN_ID", "an-id");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    await expect(
      withDb<never>(MAIN, { wranglerEnv: "production" }, () =>
        Promise.resolve(),
      ),
    ).rejects.toThrow(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set",
    );
  });

  it("names only the credential that is actually missing", async () => {
    vi.stubEnv("MAIN_ID", "an-id");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    await expect(
      withDb<never>(MAIN, { wranglerEnv: "production" }, () =>
        Promise.resolve(),
      ),
    ).rejects.toThrow("CLOUDFLARE_API_TOKEN must be set");
  });

  it("stays local when no environment is named", async () => {
    vi.stubEnv("MAIN_ID", "an-id");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    await expect(
      withDb<never>(MAIN, {}, () => Promise.resolve()),
    ).resolves.toBeUndefined();
  });
});
