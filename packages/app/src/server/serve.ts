import { host } from "#host";
import { type Env, Hono } from "hono";
import type { AcmeConfig } from "../internal/config";
import type { Handler } from "./contract";
import { setupKitRoutes } from "./kit-routes";
import { shutdownKits } from "./kit-shutdown";
import { setupKitVars } from "./kit-vars";
import { wrapWithKits } from "./kit-handler";

/**
 * Serves an app with the config's kits wired in.
 *
 * @param config Defaults to `virtual:acme-config`.
 */
export function serve<AppEnv extends Env>(
  app: Hono<AppEnv>,
  config?: AcmeConfig,
): Handler {
  const outer = new Hono<AppEnv>();
  setupKitVars(outer, config);

  outer.route("/", app);

  // After the app's routes: a kit's catch-all would otherwise swallow them.
  setupKitRoutes(outer, config);

  return host.serve(wrapWithKits(outer, config), () => shutdownKits(config));
}
