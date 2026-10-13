import type { ServerBuild } from "react-router";
import { honoContext } from "../kit";

declare module "../kit" {
  interface RouterEnv {
    Variables: { viewer?: string };
  }
}

// Stands in for an app's router build: one root route, rendered as its path
// and the viewer the Hono context carries.
const root = { id: "root", path: "", module: { default: () => null } };

export const assets: ServerBuild["assets"] = {
  entry: { module: "/entry.client.js", imports: [] },
  routes: {
    root: {
      id: "root",
      path: "",
      module: "/root.js",
      hasAction: false,
      hasLoader: false,
      hasClientAction: false,
      hasClientLoader: false,
      hasClientMiddleware: false,
      hasErrorBoundary: false,
      clientActionModule: undefined,
      clientLoaderModule: undefined,
      clientMiddlewareModule: undefined,
      hydrateFallbackModule: undefined,
    },
  },
  url: "/manifest.js",
  version: "fixture",
};
export const assetsBuildDirectory = "dist/client";
export const basename = "/";
export const entry: ServerBuild["entry"] = {
  module: {
    default: (request, status, headers, _routerContext, loadContext) => {
      const { pathname } = new URL(request.url);
      const ctx = loadContext.get(honoContext);
      const viewer = ctx.var.viewer ?? "nobody";
      const body = `rendered ${pathname} for ${viewer}`;

      return new Response(body, { status, headers });
    },
  },
};
export const future = {};
export const isSpaMode = false;
export const prerender: string[] = [];
export const publicPath = "/";
export const routeDiscovery: ServerBuild["routeDiscovery"] = {
  mode: "initial",
  manifestPath: "/__manifest",
};
export const routes: ServerBuild["routes"] = { root };
export const ssr = true;
