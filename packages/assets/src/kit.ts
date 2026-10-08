import type { Kit } from "@acme/app";
import type { Context } from "hono";
import { type AssetsBindings, type AssetsConfig, assets } from "./assets";

/**
 * The assets kit: an app's static files, and the shell behind them.
 *
 * Mounts a catch-all, which the sort keeps behind every other kit's routes
 * whatever order the app declared. Workers serve from the platform's assets
 * binding; a node host serves from `root`, which defaults to `ASSETS_ROOT` and
 * then to vite's client build directory.
 */
export function assetsKit(config: AssetsConfig = {}): Kit {
  return {
    name: "@acme/assets",
    config,
    // A route behind this kit's catch-all never sees a request.
    priority: 9999,
    init: () => ({
      routes: (app) => {
        const serve = assets.createHandler(config);
        const { fallback } = config;

        app.all("*", async (ctx: Context<{ Bindings: AssetsBindings }>) => {
          const response = await serve(ctx);

          return response.status === 404 && fallback ? fallback(ctx) : response;
        });
      },
    }),
  };
}
