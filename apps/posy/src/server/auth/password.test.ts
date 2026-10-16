import { resetDb } from "@acme/db/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { seeded } from "./test-utils";

const PASS = "test-dummy-pass";

interface KeyCost {
  hash: unknown;
  iterations: number;
}

describe("hashPassword", () => {
  it("answers a pbkdf2 string that does not contain the password", async () => {
    const hash = await hashPassword(PASS);
    expect(hash).toMatch(/^pbkdf2\$/u);
    expect(hash).not.toContain(PASS);
  });
});

describe("verifyPassword", () => {
  beforeEach(() => resetDb());
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers the user for the right password", async () => {
    const { db } = await seeded(PASS);
    const user = await verifyPassword(db, "u1", PASS);
    expect(user).toEqual({ id: "u1", name: "Tester" });
  });

  it("answers null alike for a wrong password and an unknown user", async () => {
    const { db } = await seeded(PASS);
    expect(await verifyPassword(db, "u1", "wrong")).toBeNull();
    expect(await verifyPassword(db, "nobody", PASS)).toBeNull();
  });

  // Response timing would otherwise tell which usernames exist.
  it("derives a key as costly for an unknown user as for a known one", async () => {
    const { db } = await seeded(PASS);
    const deriveBits = vi.spyOn(crypto.subtle, "deriveBits");

    await verifyPassword(db, "u1", "wrong");
    await verifyPassword(db, "nobody", PASS);
    const [known, unknown] = deriveBits.mock.calls.map(
      ([params]) => params as KeyCost,
    );
    expect(deriveBits).toHaveBeenCalledTimes(2);
    expect(unknown?.iterations).toBe(known?.iterations);
    expect(unknown?.hash).toBe(known?.hash);
  });
});
