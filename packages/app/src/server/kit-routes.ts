/// <reference path="../types.d.ts" />
import virtualConfig from "virtual:acme-config";
import type { Env, Hono } from "hono";
import { type AcmeConfig, getKitState } from "../internal/config";

/**
 * Adds every declared kit's routes to the app.
 *
 * `serve` calls this itself, after the app has added its own routes. Call it
 * directly only where an app is built without being served, meaning a test.
 *
 * @param config Defaults to `virtual:acme-config`.
 */
export function setupKitRoutes<AppEnv extends Env>(
  app: Hono<AppEnv>,
  config: AcmeConfig = virtualConfig,
): void {
  for (const kit of config.kits ?? []) {
    getKitState(kit).routes?.(app);
  }
}
