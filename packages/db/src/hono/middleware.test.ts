import { createEmptyDialect } from "#testing/runtime";
import { Hono } from "hono";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { createDbSource } from "../internal/source";
import { type DbVariables, dbMiddleware } from "./middleware";

interface TestSchema {
  widgets: { id: string };
}

// Carries Bindings too, so mounting on a bindings-typed app is type-checked
// here rather than discovered later in an app.
interface TestBindings {
  DB?: unknown;
}

interface TestEnv {
  Bindings: TestBindings;
  Variables: DbVariables<TestSchema>;
}

async function appOverEmptyDb() {
  const source = createDbSource<TestSchema>({
    dialect: await createEmptyDialect(),
  });
  const app = new Hono<TestEnv>();
  app.use("/db/*", dbMiddleware(source));

  app.get("/db/create", async (ctx) => {
    await ctx.var.db.schema
      .createTable("widgets")
      .addColumn("id", "text", (col) => col.primaryKey())
      .execute();
    return ctx.json({ ok: true });
  });

  app.get("/db/insert", async (ctx) => {
    await ctx.var.db.insertInto("widgets").values({ id: "w1" }).execute();
    return ctx.json({ ok: true });
  });

  app.get("/db/count", async (ctx) => {
    const rows = await sql<{ total: number }>`
      select count(*) as total from widgets
    `.execute(ctx.var.db);
    return ctx.json({ count: Number(rows.rows[0]?.total) });
  });

  return app;
}

describe("dbMiddleware", () => {
  it("puts a usable database on the context", async () => {
    const app = await appOverEmptyDb();
    const res = await app.request("/db/create");
    expect(res.status).toBe(200);
  });

  // Proves the middleware hands over one database, not a fresh one per
  // request: an earlier write has to be visible later.
  it("keeps writes visible across requests", async () => {
    const app = await appOverEmptyDb();
    await app.request("/db/create");
    await app.request("/db/insert");

    const res = await app.request("/db/count");
    expect(await res.json()).toEqual({ count: 1 });
  });

  it("surfaces a source that cannot resolve as a failed request", async () => {
    const app = new Hono<TestEnv>();
    // No url and no binding on this env: both arms refuse.
    app.use("/db/*", dbMiddleware(createDbSource<TestSchema>()));
    app.get("/db/query", (ctx) => ctx.json({ ok: Boolean(ctx.var.db) }));

    const res = await app.request("/db/query");
    expect(res.status).toBe(500);
  });

  it("leaves routes it is not mounted on alone", async () => {
    const app = await appOverEmptyDb();
    app.get("/plain", (ctx) => ctx.json({ ok: true }));

    const res = await app.request("/plain");
    expect(res.status).toBe(200);
  });
});
