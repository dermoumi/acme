/// <reference path="./server-build.d.ts" />
import type { Kit } from "@acme/app";
import type { AssetsFallback } from "@acme/assets";
import type { Context } from "hono";
import {
  createContext,
  createRequestHandler,
  type HandleErrorFunction,
  isRouteErrorResponse,
  RouterContextProvider,
  type ServerBuild,
} from "react-router";

// Also declared by @acme/sentry; importing its type drags its server types into routes.
declare module "@acme/app" {
  interface KitShared {
    reportError: ReportError;
  }
}

type ReportError = (ctx: Context, error: unknown) => void;

/**
 * The Hono env `honoContext` carries, empty until the app augments it.
 */
// oxlint-disable-next-line no-empty-object-type
export interface RouterEnv {}

/**
 * The request's Hono context, read in a loader or action with `context.get`.
 */
export const honoContext = createContext<Context<RouterEnv>>();

// React Router answers loader and action errors itself, so Hono's onError never sees them.
function createReportingBuild(
  build: ServerBuild,
  findReportError: () => ReportError | undefined,
): ServerBuild {
  const appHandleError = build.entry.module.handleError;
  const handleError: HandleErrorFunction = (error, args) => {
    if (args.request.signal.aborted) return;

    if (appHandleError) {
      appHandleError(error, args);
    } else {
      console.error(error);
    }

    const isExpected = isRouteErrorResponse(error) && error.status < 500;
    if (!isExpected) {
      findReportError()?.(args.context.get(honoContext), error);
    }
  };

  return {
    ...build,
    entry: { ...build.entry, module: { ...build.entry.module, handleError } },
  };
}

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

      // At error time, not now: a kit declared after this one registers later.
      const findReportError = (): ReportError | undefined => {
        try {
          return require("reportError");
        } catch {
          return undefined;
        }
      };

      const handleRequest = createRequestHandler(
        async () => {
          const build = await import("virtual:react-router/server-build");
          return createReportingBuild(build, findReportError);
        },
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
