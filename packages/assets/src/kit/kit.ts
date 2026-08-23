import type { Kit } from "@acme/app";
import { type AssetsConfig, assets } from "../assets";

/**
 * The assets kit: an app's static files, and the shell behind them.
 *
 * ```ts
 * kits: [databaseKit([...]), assetsKit()],
 * ```
 *
 * Mounts a catch-all, so it belongs last in `kits`: whatever a kit adds after
 * it never sees a request. Workers serve from the platform's assets binding;
 * a node host serves from `root`, which defaults to `ASSETS_ROOT` and then to
 * vite's client build directory.
 *
 * @param config What this app serves, if not the defaults.
 */
export function assetsKit(config: AssetsConfig = {}): Kit {
  return {
    name: "@acme/assets",
    config,
    init: () => ({
      routes: (app) => {
        app.all("*", assets.createHandler(config));
      },
    }),
  };
}
