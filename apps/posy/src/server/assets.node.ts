import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { GateBindings } from "./gate";

/**
 * Builds an ASSETS-shaped binding backed by the filesystem, for node hosts.
 *
 * ```ts
 * const env = { ASSETS: staticAssets("./dist/client") };
 * ```
 *
 * Unmatched paths serve `index.html`, matching the Workers assets binding
 * configured with `not_found_handling: "single-page-application"`.
 *
 * @param root Directory to serve from, relative to the process working directory.
 */
export function staticAssets(root: string): GateBindings["ASSETS"] {
  const assets = new Hono();
  assets.use("*", serveStatic({ root }));
  assets.get("*", serveStatic({ path: "./index.html", root }));

  return { fetch: async (request) => assets.fetch(request) };
}
