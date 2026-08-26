import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import {
  type Assets,
  type AssetsFetcher,
  DEFAULT_ROOT,
  type AssetsConfig,
} from "./contract";

/**
 * Builds an ASSETS-shaped binding backed by the filesystem, for node hosts.
 *
 * A path with no file behind it answers 404 carrying `index.html`, so a client
 * router still boots on it while crawlers and caches are told the truth.
 * Workers hand back a 200 there instead.
 *
 * @param root Directory to serve from, relative to the working directory.
 */
function createStaticAssets(root: string): AssetsFetcher {
  const files = new Hono();
  files.use("*", serveStatic({ root }));

  const shell = new Hono();
  shell.get("*", serveStatic({ path: "./index.html", root }));

  return {
    fetch: async (request) => {
      const found = await files.fetch(request);
      if (found.status !== 404) {
        return found;
      }

      // Composed rather than rewrapped in place: setting the status around
      // serveStatic answers a 404 with an empty body.
      const page = await shell.fetch(request);

      return new Response(page.body, { status: 404, headers: page.headers });
    },
  };
}

// What the app declared, then what the deployment set, then where vite puts a
// client build. Read once: a node process serves every request from one place.
function resolveRoot(config: AssetsConfig): string {
  return config.root ?? process.env.ASSETS_ROOT ?? DEFAULT_ROOT;
}

export const assets: Assets = {
  createHandler: (config) => {
    const root = resolveRoot(config);
    const files = createStaticAssets(root);

    return (ctx) => {
      return files.fetch(ctx.req.raw);
    };
  },
};
