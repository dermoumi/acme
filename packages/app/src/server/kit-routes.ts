/// <reference path="../types.d.ts" />
import virtualConfig from "virtual:acme-config";
import type { Env, Hono } from "hono";
import { type AcmeConfig, getKitState } from "../internal/config";

export function setupKitRoutes<AppEnv extends Env>(
  app: Hono<AppEnv>,
  config: AcmeConfig = virtualConfig,
): void {
  for (const kit of config.kits ?? []) {
    getKitState(kit).routes?.(app);
  }
}
