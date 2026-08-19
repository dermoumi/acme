import virtualConfig from "virtual:acme-config";
import type { MiddlewareHandler } from "hono";
import type { AcmeConfig, KitVars } from "../internal/config";

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
