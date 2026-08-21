import type { AcmeConfig } from "@acme/app";
import { kitVars } from "@acme/app/testing";
import { Hono } from "hono";
import type { GetDb } from "../internal/db";

// Through @acme/app rather than off the kit: the request path and what this
// package reads back must land on one set of accessors.
export async function getDbOnRequest(
  config: AcmeConfig,
  env: unknown,
): Promise<GetDb> {
  const app = new Hono();
  app.use(kitVars(config));

  let handed: GetDb | undefined;
  app.get("/db", (ctx) => {
    handed = ctx.var.getDb;

    return ctx.body(null);
  });
  await app.fetch(new Request("http://db.test/db"), env);
  if (!handed) {
    throw new Error("the request never reached the route");
  }

  return handed;
}
