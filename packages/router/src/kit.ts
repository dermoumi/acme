/// <reference path="./server-build.d.ts" />
import type { ErrorPageDetails, Kit, RenderErrorPage } from "@acme/app";
import type { AssetsFallback } from "@acme/assets";
import type { Context } from "hono";
import {
  createContext,
  createRequestHandler,
  data,
  type HandleErrorFunction,
  isRouteErrorResponse,
  type MiddlewareFunction,
  type RequestHandler,
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

// Null, not undefined: React Router reads an undefined default as none and throws.
const errorPageContext = createContext<ErrorPageDetails | null>(null);

// Ahead of every loader: the page is the root boundary, and nothing may run twice.
const throwErrorPage: MiddlewareFunction<Response> = ({ context }, next) => {
  const details = context.get(errorPageContext);
  if (details === null) return next();

  const init = { status: details.status };
  // oxlint-disable-next-line only-throw-error -- how a route answers a status
  throw data({ reference: details.reference }, init);
};

function createErrorPageBuild(build: ServerBuild): ServerBuild {
  const { root } = build.routes;
  if (root === undefined) return build;

  const middleware = [throwErrorPage, ...(root.module.middleware ?? [])];
  const module = { ...root.module, middleware };

  return { ...build, routes: { ...build.routes, root: { ...root, module } } };
}

// React Router answers loader and action errors itself, so Hono's onError never sees them.
function createReportingBuild(
  build: ServerBuild,
  findReportError: () => ReportError | undefined,
): ServerBuild {
  const appHandleError = build.entry.module.handleError;
  const handleError: HandleErrorFunction = (error, args) => {
    if (args.request.signal.aborted) return;
    // Hono's onError reported this one already.
    if (args.context.get(errorPageContext) !== null) return;

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

function createErrorPageRenderer(
  handleRequest: RequestHandler,
): RenderErrorPage {
  return async (ctx, details) => {
    const context = new RouterContextProvider();
    context.set(honoContext, ctx as Context<RouterEnv>);
    context.set(errorPageContext, details);
    // A GET, so a failed form post renders the page instead of posting again.
    const headers = new Headers(ctx.req.raw.headers);
    headers.delete("content-length");
    headers.delete("content-type");
    const request = new Request(ctx.req.url, { headers });

    const response = await handleRequest(request, context);
    // No route with a component matched, or the boundary failed to render.
    const isPage =
      response.status === details.status &&
      (response.headers.get("content-type")?.includes("text/html") ?? false);
    if (!isPage) {
      const message = `The router answered ${response.status}, not the error page`;
      throw new Error(message);
    }

    return response;
  };
}

/**
 * The router kit: renders every page no static file answers with React Router.
 *
 * Requires `@acme/assets`. Brings the router's vite plugins, and builds the
 * server from `src/server/index.ts`.
 *
 * Renders an error Hono caught as the root `ErrorBoundary`, but only at a URL
 * a route with a component matches: give the splat route `*` one.
 */
export function routerKit(): Kit {
  return {
    name: "@acme/router",
    vite: "@acme/router/vite",
    requires: ["@acme/assets"],
    init: ({ register, require }) => {
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
          const reporting = createReportingBuild(build, findReportError);
          return createErrorPageBuild(reporting);
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

      const renderErrorPage = createErrorPageRenderer(handleRequest);
      register("renderErrorPage", renderErrorPage);

      return {};
    },
  };
}
