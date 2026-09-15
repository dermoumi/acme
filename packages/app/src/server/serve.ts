/// <reference path="../types.d.ts" />
import { host } from "#host";
import virtualConfig from "virtual:acme-config";
import { type Env, Hono } from "hono";
import { type AcmeConfig, getKitState } from "../internal/config";
import type { Handler } from "./contract";
import { setupKitVars } from "./kit-vars";

export function setupKitRoutes<AppEnv extends Env>(
  app: Hono<AppEnv>,
  config: AcmeConfig = virtualConfig,
): void {
  for (const kit of config.kits ?? []) {
    getKitState(kit).routes?.(app);
  }
}

export function setupKitMiddleware<AppEnv extends Env>(
  app: Hono<AppEnv>,
  config: AcmeConfig = virtualConfig,
): void {
  for (const kit of config.kits ?? []) {
    getKitState(kit).middleware?.(app);
  }
}

export function wrapWithKits(
  handler: Handler,
  config: AcmeConfig = virtualConfig,
): Handler {
  let wrapped = handler;

  // Right to left, so the first kit the config lists ends up outermost.
  for (const kit of (config.kits ?? []).toReversed()) {
    wrapped = getKitState(kit).handler?.(wrapped) ?? wrapped;
  }

  return wrapped;
}

export async function shutdownKits(
  config: AcmeConfig = virtualConfig,
): Promise<void> {
  const closing = (config.kits ?? []).map((kit) => {
    return Promise.resolve(getKitState(kit).shutdown?.());
  });

  await Promise.all(closing);
}

/**
 * Wires the config's kits into an app, without serving it.
 *
 * Excludes what needs a host: the kit wrappers and the shutdown hook.
 *
 * @param config Defaults to `virtual:acme-config`.
 */
export function composeApp<AppEnv extends Env>(
  app: Hono<AppEnv>,
  config?: AcmeConfig,
): Hono<AppEnv> {
  const outer = new Hono<AppEnv>();
  setupKitVars(outer, config);
  // Ahead of the app's routes: a cap mounted behind one would never run.
  setupKitMiddleware(outer, config);

  outer.route("/", app);

  // After the app's routes: a kit's catch-all would otherwise swallow them.
  setupKitRoutes(outer, config);

  return outer;
}

/**
 * Serves an app with the config's kits wired in.
 *
 * @param config Defaults to `virtual:acme-config`.
 */
export function serve<AppEnv extends Env>(
  app: Hono<AppEnv>,
  config?: AcmeConfig,
): Handler {
  const composed = composeApp(app, config);

  return host.serve(wrapWithKits(composed, config), () => shutdownKits(config));
}
