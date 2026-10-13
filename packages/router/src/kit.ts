/// <reference path="./server-build.d.ts" />
import type { Kit } from "@acme/app";
import type { AssetsFallback } from "@acme/assets";
import type { Context } from "hono";
import {
  createContext,
  createRequestHandler,
  RouterContextProvider,
} from "react-router";

/**
 * The Hono env `honoContext` carries, empty until the app augments it.
 */
// oxlint-disable-next-line no-empty-object-type
export interface RouterEnv {}

/**
 * The request's Hono context, read in a loader or action with `context.get`.
 */
export const honoContext = createContext<Context<RouterEnv>>();

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
      const render: AssetsFallback = async (ctx) => {
        const context = new RouterContextProvider();
        // The app declares its env by augmenting RouterEnv; Hono cannot check it.
        context.set(honoContext, ctx as Context<RouterEnv>);

        return handleRequest(ctx.req.raw, context);
      };
      setAssetsFallback(render);

      return {};
    },
  };
}
