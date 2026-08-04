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

// Neither arm can resolve this: node is given no url, workerd no such binding.
const unresolvable = { binding: "NO_SUCH_BINDING" };

async function appOverEmptyDb() {
  const source = createDbSource<TestSchema>({
    dialect: await createEmptyDialect(),
  });
  const app = new Hono<TestEnv>();
  app.use(dbMiddleware(source));

  app.get("/db/create", async (ctx) => {
    const db = await ctx.var.db();
    await db.schema
      .createTable("widgets")
      .addColumn("id", "text", (col) => col.primaryKey())
      .execute();
    return ctx.json({ ok: true });
  });

  app.get("/db/insert", async (ctx) => {
    const db = await ctx.var.db();
    await db.insertInto("widgets").values({ id: "w1" }).execute();
    return ctx.json({ ok: true });
  });

  app.get("/db/count", async (ctx) => {
    const rows = await sql<{ total: number }>`
      select count(*) as total from widgets
    `.execute(await ctx.var.db());
    return ctx.json({ count: Number(rows.rows[0]?.total) });
  });

  return app;
}

describe("dbMiddleware", () => {
  it("hands a handler a usable database", async () => {
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

  // The reason it can be mounted app-wide: a route that never asks pays nothing,
  // so even a source that cannot resolve leaves it untouched.
  it("resolves nothing until a handler asks", async () => {
    const app = new Hono<TestEnv>();
    app.use(dbMiddleware(createDbSource<TestSchema>(unresolvable)));
    app.get("/quiet", (ctx) => ctx.json({ ok: true }));

    const res = await app.request("/quiet");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("surfaces a source that cannot resolve as a failed request", async () => {
    const app = new Hono<TestEnv>();
    app.use(dbMiddleware(createDbSource<TestSchema>(unresolvable)));
    app.get("/db/query", async (ctx) =>
      ctx.json({ ok: !!(await ctx.var.db()) }),
    );

    const res = await app.request("/db/query");
    expect(res.status).toBe(500);
  });

  it("resolves once per request however often it is asked", async () => {
    const app = await appOverEmptyDb();
    app.get("/twice", async (ctx) => {
      const [first, second] = [await ctx.var.db(), await ctx.var.db()];
      return ctx.json({ same: first === second });
    });

    const res = await app.request("/twice");
    expect(await res.json()).toEqual({ same: true });
  });
});
