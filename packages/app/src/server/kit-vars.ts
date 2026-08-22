/// <reference path="../types.d.ts" />
import virtualConfig from "virtual:acme-config";
import type { MiddlewareHandler } from "hono";
import { type AcmeConfig, getKitState } from "../internal/config";

/**
 * Puts every declared kit's variables on each request.
 *
 * ```ts
 * app.use(getKitVars());
 * ```
 *
 * `serve` mounts this itself. Reach for it where an app is built without being
 * served, which in practice means a test driving routes directly.
 *
 * @param config The app's own, taken from `virtual:acme-config` unless one is
 *   passed. Pass one to mount a config a test built rather than the app's.
 */
export function getKitVars(
  config: AcmeConfig = virtualConfig,
): MiddlewareHandler {
  const allVars = (config.kits ?? [])
    .map((kit) => getKitState(kit).vars)
    .filter((vars) => vars !== undefined);
  // Flattened on the first request and read back on the rest: workerd hands
  // every request in an isolate one env object, and node hands process.env.
  let held: { env: unknown; entries: [string, unknown][] } | undefined;

  return async (ctx, next) => {
    if (held === undefined || held.env !== ctx.env) {
      const flat = allVars.flatMap((vars) => Object.entries(vars(ctx.env)));
      held = { env: ctx.env, entries: flat };
    }

    for (const [key, value] of held.entries) {
      ctx.set(key, value);
    }

    return next();
  };
}
