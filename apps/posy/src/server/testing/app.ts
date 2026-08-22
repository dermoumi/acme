import { getKitVars } from "@acme/app/testing";
import { Hono } from "hono";
import { createApp } from "../app";
import type { AppEnv } from "../bindings";

/**
 * posy's app with the kits' variables in front, as `serve` would build it.
 *
 * Routes read `ctx.var`, so driving them needs whatever puts it there; the
 * entry cannot stand in, since importing it would start a server.
 */
export function testApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  const middleware = getKitVars();
  app.use(middleware);

  app.route("/", createApp());

  return app;
}
