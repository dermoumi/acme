import { setupKitRoutes, setupKitVars } from "@acme/app/testing";
import { Hono } from "hono";
import { createApp } from "../app";
import type { AppEnv } from "../bindings";

/**
 * posy's app with the kits around it, as `serve` would build it.
 *
 * Routes read `ctx.var` and unclaimed paths fall through to a kit, so driving
 * them needs both halves; the entry cannot stand in, since importing it would
 * start a server.
 */
export function testApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  setupKitVars(app);
  app.route("/", createApp());
  setupKitRoutes(app);

  return app;
}
