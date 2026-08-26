/// <reference path="../types.d.ts" />
import virtualConfig from "virtual:acme-config";
import type { Env, Hono, MiddlewareHandler } from "hono";
import { type AcmeConfig, getKitState } from "../internal/config";

/**
 * Puts every declared kit's variables on each request the app answers.
 *
 * `serve` calls this itself, before the app adds its routes. Call it directly
 * only where an app is built without being served, meaning a test.
 *
 * @param config Defaults to `virtual:acme-config`.
 */
export function setupKitVars<AppEnv extends Env>(
  app: Hono<AppEnv>,
  config: AcmeConfig = virtualConfig,
): void {
  const allVars = (config.kits ?? [])
    .map((kit) => getKitState(kit).vars)
    .filter((vars) => vars !== undefined);
  // Flattened on the first request and read back on the rest: workerd hands
  // every request in an isolate one env object, and node hands process.env.
  let held: { env: unknown; entries: [string, unknown][] } | undefined;

  const middleware: MiddlewareHandler = async (ctx, next) => {
    if (held === undefined || held.env !== ctx.env) {
      const flat = allVars.flatMap((vars) => Object.entries(vars(ctx.env)));
      held = { env: ctx.env, entries: flat };
    }

    for (const [key, value] of held.entries) {
      ctx.set(key, value);
    }

    return next();
  };

  app.use(middleware);
}
