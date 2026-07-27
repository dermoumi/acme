import { withSentry } from "@acme/sentry/hono";
import type { ExportedHandler } from "@cloudflare/workers-types";
import type { AppBindings } from "./bindings";
import app from "./index";

// Wraps the app rather than replacing it: Hono still runs every middleware in order.
const handler: ExportedHandler<AppBindings> = {
  fetch: (request, env, ctx) =>
    withSentry(env, request, ctx, () => app.fetch(request, env, ctx)),
};

export default handler;
