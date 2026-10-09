/// <reference path="./server-build.d.ts" />
import type { Kit } from "@acme/app";
import { createRequestHandler } from "react-router";

/**
 * The router kit: renders every page no static file answers with React Router.
 *
 * Requires `@acme/assets`. Brings the router's vite plugins, and builds the
 * server from `src/server/index.ts`.
 */
export function routerKit(): Kit {
  return {
    name: "@acme/router",
    vite: "@acme/router/vite",
    requires: ["@acme/assets"],
    init: ({ require }) => {
      const setAssetsFallback = require("setAssetsFallback");

      const handleRequest = createRequestHandler(
        async () => import("virtual:react-router/server-build"),
        import.meta.env.MODE,
      );
      setAssetsFallback(async (ctx) => handleRequest(ctx.req.raw));

      return {};
    },
  };
}
