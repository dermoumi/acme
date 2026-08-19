/// <reference path="../types.d.ts" />
import virtualConfig from "virtual:acme-config";
import type { MiddlewareHandler } from "hono";
import type { AcmeConfig } from "../internal/config";

/**
 * Puts every declared kit's variables on each request.
 *
 * ```ts
 * app.use(kitVars());
 * ```
 *
 * `serve` mounts this itself. Reach for it where an app is built without being
 * served, which in practice means a test driving routes directly.
 *
 * @param config The app's own, taken from `virtual:acme-config` unless one is
 *   passed. Pass one to mount a config a test built rather than the app's.
 */
export function kitVars(config: AcmeConfig = virtualConfig): MiddlewareHandler {
  const allVars = (config.kits ?? [])
    .map((kit) => kit.init?.().vars)
    .filter((vars) => vars !== undefined);

  return async (ctx, next) => {
    for (const vars of allVars) {
      for (const [key, value] of Object.entries(vars(ctx.env))) {
        ctx.set(key, value);
      }
    }

    return next();
  };
}
