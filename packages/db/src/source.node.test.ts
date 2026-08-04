import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createDbSource } from "./source";

describe("createDbSource on node", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "acme-db-source-"));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("opens the connection once and reuses it", async () => {
    const source = createDbSource({ url: ":memory:" });
    expect(await source.resolve()).toBe(await source.resolve());
  });

  it("keeps two sources on separate connections", async () => {
    const first = createDbSource({ url: ":memory:" });
    const second = createDbSource({ url: ":memory:" });
    expect(await first.resolve()).not.toBe(await second.resolve());
  });

  it("ignores env, which belongs to the workerd arm", async () => {
    const source = createDbSource({ url: ":memory:" });
    expect(await source.resolve({ DB: "irrelevant" })).toBe(
      await source.resolve(),
    );
  });

  describe("refuses what it cannot open", () => {
    it("names a missing url", async () => {
      await expect(createDbSource().resolve()).rejects.toThrow(
        /no database url/u,
      );
    });

    it("names an unsupported scheme", async () => {
      const source = createDbSource({ url: "mysql://localhost/db" });
      await expect(source.resolve()).rejects.toThrow(
        /unsupported database url/u,
      );
    });
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
