import type { Kit } from "@acme/app";
import { Kysely } from "kysely";
import { describe, expect, it } from "vitest";
import { emptyDbEnv } from "../../testing";
import type { GetDb } from "./get-db";
import { databaseKit } from "./kit";

interface Items {
  items: { id: string };
}

// What an app declares beside its schema, and what gives getDb its type. A real
// one augments "@acme/db"; this is inside the package, so it names the module.
declare module "./get-db" {
  interface Databases {
    DATABASE: Items;
    OTHER: Items;
  }
}

describe("the databases a kit puts on a request", () => {
  // DATABASE because that is the binding the workers pool provides; OTHER only
  // has to exist, so the error below can name more than one.
  const newKit = () => {
    return databaseKit([{ binding: "DATABASE" }, { binding: "OTHER" }]);
  };

  // What a host does per request. The cast is one no consumer writes: routes
  // read ctx.var.getDb, which the hono augmentation types for them.
  const onRequest = (kit: Kit, env: unknown): GetDb => {
    return kit.vars?.(env).getDb as GetDb;
  };

  it("opens the one a binding names", async () => {
    const getDb = onRequest(newKit(), await emptyDbEnv("DATABASE"));

    await expect(getDb("DATABASE")).resolves.toBeInstanceOf(Kysely);
  });

  it("hands every request the same connection", async () => {
    const env = await emptyDbEnv("DATABASE");
    const kit = newKit();

    const first = await onRequest(kit, env)("DATABASE");
    const second = await onRequest(kit, env)("DATABASE");

    expect(first).toBe(second);
  });

  it("refuses a binding the app never declared, naming what it has", async () => {
    const getDb = onRequest(newKit(), await emptyDbEnv("DATABASE"));

    expect(() =>
      // @ts-expect-error nothing declared a database under this name
      getDb("NOPE"),
    ).toThrow(/no database bound to NOPE: DATABASE, OTHER/u);
  });
});
