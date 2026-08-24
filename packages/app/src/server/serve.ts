import { host } from "#host";
import { type Env, Hono } from "hono";
import type { AcmeConfig } from "../internal/config";
import type { Handler } from "./contract";
import { setupKitRoutes } from "./kit-routes";
import { setupKitVars } from "./kit-vars";
import { wrapWithKits } from "./kit-handler";

/**
 * Builds an app, hands it to the caller to route, and serves it.
 *
 * ```ts
 * export default serve((app) => {
 *   app.get("/health", (ctx) => ctx.json({ status: "ok" }));
 * });
 * ```
 *
 * Every kit the config declares puts its variables on each request before the
 * app sees it, so a route reads `ctx.var` rather than knowing what a kit is,
 * adds whatever routes it contributes behind the app's own, and puts whatever
 * it wraps the app in around the lot.
 *
 * @param setup Adds the app's routes.
 * @param config The app's own, taken from `virtual:acme-config` unless one is
 *   passed. Pass one to serve a config a test built rather than the app's.
 */
export function serve<AppEnv extends Env>(
  setup: (app: Hono<AppEnv>) => void,
  config?: AcmeConfig,
): Handler {
  const app = new Hono<AppEnv>();
  setupKitVars(app, config);

  setup(app);
  // After the setup, unlike the variables: a kit contributing a catch-all
  // would swallow every route the app was about to register.
  setupKitRoutes(app, config);

  return host.serve(wrapWithKits(app, config));
}
