import { host } from "#host";
import { type Env, Hono } from "hono";
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
 * Builds an app, hands it to the caller to route, and serves it.
 *
 * ```ts
 * export default createApp(config, (app) => {
 *   app.get("/health", (ctx) => ctx.json({ status: "ok" }));
 * });
 * ```
 *
 * Every kit the config declares puts its variables on each request before the
 * app sees it, so a route reads `ctx.var` rather than knowing what a kit is.
 *
 * @param config The app's config, as `acme.config.ts` default-exports it.
 * @param setup Adds the app's routes. Returning nothing serves the app it was
 *   given; returning a handler serves that instead.
 */
export function createApp<AppEnv extends Env>(
  config: AcmeConfig,
  // Returning one is for a wrapper that cannot be middleware: withSentry needs
  // the outer fetch's ExecutionContext. Goes once @acme/sentry is a kit.
  // oxlint-disable-next-line no-invalid-void-type
  setup: (app: Hono<AppEnv>) => Handler | void,
): Handler {
  const app = new Hono<AppEnv>();
  const vars = varsOf(config);

  if (vars.length > 0) {
    app.use(async (ctx, next) => {
      for (const contribute of vars) {
        for (const [key, value] of Object.entries(contribute(ctx.env))) {
          ctx.set(key as never, value as never);
        }
      }

      return next();
    });
  }

  return host.serve(setup(app) ?? app);
}
