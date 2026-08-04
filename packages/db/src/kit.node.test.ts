import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createDbKit } from "./kit";

describe("createDbKit on node", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "acme-db-kit-"));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("opens the connection once and reuses it", async () => {
    const kit = createDbKit({ url: ":memory:" });
    expect(await kit.resolve()).toBe(await kit.resolve());
  });

  it("keeps two kits on separate connections", async () => {
    const first = createDbKit({ url: ":memory:" });
    const second = createDbKit({ url: ":memory:" });
    expect(await first.resolve()).not.toBe(await second.resolve());
  });

  it("ignores env, which belongs to the workerd arm", async () => {
    const kit = createDbKit({ url: ":memory:" });
    expect(await kit.resolve({ DB: "irrelevant" })).toBe(await kit.resolve());
  });

  describe("refuses what it cannot open", () => {
    it("names a missing url", async () => {
      await expect(createDbKit().resolve()).rejects.toThrow(/no database url/u);
    });

    it("names an unsupported scheme", async () => {
      const kit = createDbKit({ url: "mysql://localhost/db" });
      await expect(kit.resolve()).rejects.toThrow(/unsupported database url/u);
    });
  });

  // Asserting a retry, not just a second failure: a cached rejection would also
  // reject twice, so only a later success proves the cache was cleared.
  it("retries a failed connection rather than caching it", async () => {
    const nested = path.join(dir, "appears-later");
    const kit = createDbKit({
      url: pathToFileURL(path.join(nested, "x.db")).href,
    });
    await expect(kit.resolve()).rejects.toThrow();

    mkdirSync(nested, { recursive: true });
    expect(await kit.resolve()).toBeDefined();
  });
});
