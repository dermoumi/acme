import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { AssetsBinding, ResolveAssets } from "./contract";

// resolveAssets is called per request, so each directory is wired once.
const served = new Map<string, AssetsBinding>();

/**
 * Builds an ASSETS-shaped binding backed by the filesystem.
 *
 * Unmatched paths serve `index.html`, matching the Workers assets binding
 * configured with `not_found_handling: "single-page-application"`.
 *
 * @param root Directory to serve from, relative to the process working directory.
 */
function staticAssets(root: string): AssetsBinding {
  const assets = new Hono();
  assets.use("*", serveStatic({ root }));
  assets.get("*", serveStatic({ path: "./index.html", root }));

  return { fetch: async (request) => assets.fetch(request) };
}

export const resolveAssets: ResolveAssets = (env, options = {}) => {
  const { binding = "ASSETS", dirVar } = options;
  const name = dirVar ?? `${binding}_DIR`;
  const root = (env as Record<string, unknown>)[name];
  if (typeof root !== "string" || !root) {
    throw new Error(`no assets directory: set ${name} on the environment`);
  }

  const built = served.get(root) ?? staticAssets(root);
  served.set(root, built);

  return built;
};
