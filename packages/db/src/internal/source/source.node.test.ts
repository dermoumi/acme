import { describe, expect, it } from "vitest";
import { createDbSource } from "./source";

// The project's own url, so these run against a real postgres pool as well as
// sqlite. Nothing here is engine-specific: it is the node arm's caching.
const url = process.env.ACME_DB_TEST_URL ?? ":memory:";

describe("createDbSource on node", () => {
  it("opens the connection once and reuses it", async () => {
    const source = createDbSource({ url });
    expect(await source.resolve()).toBe(await source.resolve());
  });

  it("keeps two sources on separate connections", async () => {
    const first = createDbSource({ url });
    const second = createDbSource({ url });
    expect(await first.resolve()).not.toBe(await second.resolve());
  });

  it("ignores env, which belongs to the workerd arm", async () => {
    const source = createDbSource({ url });
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
});
