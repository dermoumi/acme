import type { Context } from "hono";

// Where a client build lands, so an app that has not moved it declares nothing.
export const DEFAULT_ROOT = "./dist/client";

/**
 * Where an app's static files come from: the platform's binding, or the
 * filesystem a node process serves them off instead.
 */
export interface AssetsFetcher {
  fetch: (request: Request) => Promise<Response>;
}

/**
 * What the workerd arm reads off the environment. The platform binds it.
 */
export interface AssetsBindings {
  ASSETS: AssetsFetcher;
}

/**
 * What an app declares the assets kit with, and what the seam is built from.
 */
export interface AssetsConfig {
  /**
   * Directory a node host serves from, relative to the process working
   * directory. Falls back to `ASSETS_ROOT`, then to where vite puts a client
   * build. Workers ignore it: the platform holds the files.
   */
  root?: string;
  /**
   * Answers a path no file matches, instead of the shell.
   *
   * Workers only reach it when the platform answers 404, so set the app's
   * `not_found_handling` to `"none"` there.
   */
  fallback?: (ctx: Context) => Response | Promise<Response>;
}

/**
 * What every arm of the `#assets` seam provides: a handler answering from the
 * app's static files, shell included.
 */
export interface Assets {
  createHandler: (
    config: AssetsConfig,
  ) => (ctx: Context<{ Bindings: AssetsBindings }>) => Promise<Response>;
}
