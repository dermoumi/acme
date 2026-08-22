/// <reference path="../types.d.ts" />
import virtualConfig from "virtual:acme-config";
import type { Env, Hono } from "hono";
import { type AcmeConfig, getKitState } from "../internal/config";

/**
 * Adds every declared kit's routes to the app.
 *
 * ```ts
 * addKitRoutes(app);
 * ```
 *
 * `serve` calls this itself, once the app has added its own routes: a kit
 * contributing a catch-all would otherwise swallow every route the app was
 * about to register. Reach for it where an app is built without being served,
 * which in practice means a test driving routes directly.
 *
 * @param app The app to add them to.
 * @param config The app's own, taken from `virtual:acme-config` unless one is
 *   passed. Pass one to mount a config a test built rather than the app's.
 */
export function addKitRoutes<AppEnv extends Env>(
  app: Hono<AppEnv>,
  config: AcmeConfig = virtualConfig,
): void {
  for (const kit of config.kits ?? []) {
    getKitState(kit).routes?.(app);
  }
}
