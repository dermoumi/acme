import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Assets, AssetsBindings, AssetsFetcher } from "./contract";

/**
 * Builds an ASSETS-shaped binding backed by the filesystem, for node hosts.
 *
 * Unmatched paths serve `index.html`, matching the Workers assets binding
 * configured with `not_found_handling: "single-page-application"`.
 *
 * @param root Directory to serve from, relative to the process working directory.
 */
function createStaticAssets(root: string): AssetsFetcher {
  const files = new Hono();
  files.use("*", serveStatic({ root }));
  files.get("*", serveStatic({ path: "./index.html", root }));

  return { fetch: async (request) => files.fetch(request) };
}

// Built on first use, from the default the Dockerfile sets, and held: a node
// process serves every request from the same directory.
let disk: AssetsFetcher | undefined;

// By shape, not by truthiness: ctx.env is process.env here, so ASSETS is as
// likely to be a stray string as a fetcher something bound for a test.
function isFetcher(value: unknown): value is AssetsFetcher {
  return typeof value === "object" && value !== null && "fetch" in value;
}

export const assets: Assets = {
  handler: (ctx) => {
    const bound = (ctx.env as Partial<AssetsBindings>).ASSETS;
    if (isFetcher(bound)) {
      return bound.fetch(ctx.req.raw);
    }

    disk ??= createStaticAssets(process.env.ASSETS_DIR ?? "./dist/client");

    return disk.fetch(ctx.req.raw);
  },
};
