import type { Context } from "hono";

/**
 * Where an app's static files come from: the platform's binding, or the
 * filesystem a node process serves them off instead.
 */
export interface AssetsFetcher {
  fetch: (request: Request) => Promise<Response>;
}

/**
 * What this kit reads off the environment.
 *
 * Bound by the platform on workerd. A node process has no binding, so a
 * missing one there is the filesystem's cue rather than a fault.
 */
export interface AssetsBindings {
  ASSETS: AssetsFetcher;
}

/**
 * What every arm of the `#assets` seam provides: a request answered from the
 * app's static files, shell included.
 */
export interface Assets {
  handler: (ctx: Context<{ Bindings: AssetsBindings }>) => Promise<Response>;
}
