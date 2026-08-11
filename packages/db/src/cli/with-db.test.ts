import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withDb } from "./with-db";

const configFile = path.join(
  import.meta.dirname,
  "fixtures",
  "app",
  "acme.config.ts",
);

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
    await withDb<never>("MAIN", { configFile }, async (db) => {
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
      withDb<never>("RENAMED", { configFile }, () => Promise.resolve()),
    ).resolves.toBeUndefined();
  });

  // Reaching Cloudflare needs credentials, so failing on the missing one is
  // what proves the environment beat the url sitting right there.
  it("prefers a named wrangler environment over the url env var", async () => {
    vi.stubEnv("MAIN_ID", "an-id");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    await expect(
      withDb<never>("MAIN", { wranglerEnv: "production", configFile }, () =>
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
      withDb<never>("MAIN", { wranglerEnv: "production", configFile }, () =>
        Promise.resolve(),
      ),
    ).rejects.toThrow("CLOUDFLARE_API_TOKEN must be set");
  });

  it("stays local when no environment is named", async () => {
    vi.stubEnv("MAIN_ID", "an-id");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    await expect(
      withDb<never>("MAIN", { configFile }, () => Promise.resolve()),
    ).resolves.toBeUndefined();
  });

  it("refuses a config declaring a binding twice", async () => {
    const duplicate = path.join(dir, "duplicate.mjs");
    await writeFile(
      duplicate,
      'export default { db: [{ binding: "SAME" }, { binding: "SAME" }] };',
    );
    await expect(
      withDb<never>("SAME", { configFile: duplicate }, () => Promise.resolve()),
    ).rejects.toThrow(/declares SAME twice/u);
  });

  it("refuses a binding the config does not declare", async () => {
    await expect(
      withDb<never>("NOPE", { configFile }, () => Promise.resolve()),
    ).rejects.toThrow(/no database bound to NOPE: MAIN, ANALYTICS, RENAMED/u);
  });
});
