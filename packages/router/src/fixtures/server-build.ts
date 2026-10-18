import { data, isRouteErrorResponse, type ServerBuild } from "react-router";
import { honoContext } from "../kit";

declare module "../kit" {
  interface RouterEnv {
    Variables: { viewer?: string };
  }
}

// One root route, rendered as its path, the viewer and any root error;
// /broken and /missing make its loader fail, /bad-boundary its error render.
const root = {
  id: "root",
  path: "*",
  module: {
    default: () => null,
    loader: ({ request }: { request: Request }) => {
      const { pathname } = new URL(request.url);
      if (pathname === "/broken") throw new Error("loader exploded");
      // oxlint-disable-next-line only-throw-error -- how a loader answers a status
      if (pathname === "/missing") throw data(null, { status: 404 });

      return null;
    },
  },
};

export const assets: ServerBuild["assets"] = {
  entry: { module: "/entry.client.js", imports: [] },
  routes: {
    root: {
      id: "root",
      path: "*",
      module: "/root.js",
      hasAction: false,
      hasLoader: true,
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
    default: (request, status, headers, routerContext, loadContext) => {
      const { pathname } = new URL(request.url);
      const ctx = loadContext.get(honoContext);
      const viewer = ctx.var.viewer ?? "nobody";
      const error: unknown = routerContext.staticHandlerContext.errors?.root;
      if (pathname === "/bad-boundary" && error) {
        throw new Error("boundary exploded");
      }
      const errorSuffix = isRouteErrorResponse(error)
        ? ` failing ${error.status} ${JSON.stringify(error.data)}`
        : "";
      const body = `rendered ${pathname} for ${viewer}${errorSuffix}`;
      headers.set("Content-Type", "text/html");

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
