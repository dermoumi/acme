import { host } from "#host";
import virtualConfig from "virtual:acme-config";
import { type Env, Hono, type MiddlewareHandler } from "hono";
import type { AcmeConfig, KitVars } from "../internal/config";
import type { Handler } from "./contract";

function varsOf(config: AcmeConfig): KitVars[] {
  return (config.kits ?? [])
    .map((kit) => {
      return kit.vars;
    })
    .filter((vars) => vars !== undefined);
}

/**
 * Puts every declared kit's variables on each request.
 *
 * ```ts
 * app.use(kitVars(config));
 * ```
 *
 * {@link serve} mounts this itself. Reach for it where an app is built without
 * being served, which in practice means a test driving routes directly.
 */
export function kitVars(config: AcmeConfig): MiddlewareHandler {
  const vars = varsOf(config);

  return async (ctx, next) => {
    for (const contribute of vars) {
      for (const [key, value] of Object.entries(contribute(ctx.env))) {
        ctx.set(key as never, value as never);
      }
    }

    return next();
  };
}

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
  config: AcmeConfig = virtualConfig,
): Handler {
  const app = new Hono<AppEnv>();
  app.use(kitVars(config));

  return host.serve(setup(app) ?? app);
}
