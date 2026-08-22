import type { Kit } from "@acme/app";
import { assets } from "../assets";

/**
 * The assets kit: an app's static files, and the shell behind them.
 *
 * ```ts
 * kits: [databaseKit([...]), assetsKit()],
 * ```
 *
 * Mounts a catch-all, so it belongs last in `kits`: whatever a kit adds after
 * it never sees a request. What it serves is the platform's assets binding
 * where there is one, and the directory `ASSETS_DIR` names otherwise.
 */
export function assetsKit(): Kit {
  return {
    name: "@acme/assets",
    init: () => ({
      routes: (app) => {
        app.all("*", assets.handler);
      },
    }),
  };
}
