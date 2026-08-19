import { host } from "#host";
import { type Env, Hono } from "hono";
import type { AcmeConfig } from "../internal/config";
import type { Handler } from "./contract";
import { kitVars } from "./kit-vars";

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
 * app sees it, so a route reads `ctx.var` rather than knowing what a kit is.
 *
 * @param setup Adds the app's routes. Returning nothing serves the app it was
 *   given; returning a handler serves that instead.
 * @param config The app's own, taken from `virtual:acme-config` unless one is
 *   passed. Pass one to serve a config a test built rather than the app's.
 */
export function serve<AppEnv extends Env>(
  // Returning one is for a wrapper that cannot be middleware: withSentry needs
  // the outer fetch's ExecutionContext. Goes once @acme/sentry is a kit.
  // oxlint-disable-next-line no-invalid-void-type
  setup: (app: Hono<AppEnv>) => Handler | void,
  config?: AcmeConfig,
): Handler {
  const app = new Hono<AppEnv>();
  app.use(kitVars(config));

  return host.serve(setup(app) ?? app);
}
