import type { Kit } from "@acme/app";
import type { Context } from "hono";
import { type AssetsBindings, type AssetsConfig, assets } from "./assets";

declare module "@acme/app" {
  interface KitShared {
    setAssetsFallback: SetAssetsFallback;
  }
}

/**
 * Answers a path no file matches, in place of the shell.
 */
export type AssetsFallback = (ctx: Context) => Response | Promise<Response>;

/**
 * Hands every path no file matches to one fallback, such as a server renderer.
 *
 * Workers only reach it when the platform answers 404, so set the app's
 * `not_found_handling` to `"none"` there.
 */
export type SetAssetsFallback = (fallback: AssetsFallback) => void;

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
    init: ({ register }) => {
      let fallback: AssetsFallback | undefined;
      register("setAssetsFallback", (next) => {
        fallback = next;
      });

      return {
        routes: (app) => {
          const serve = assets.createHandler(config);

          app.all("*", async (ctx: Context<{ Bindings: AssetsBindings }>) => {
            const response = await serve(ctx);

            return response.status === 404 && fallback
              ? fallback(ctx)
              : response;
          });
        },
      };
    },
  };
}
