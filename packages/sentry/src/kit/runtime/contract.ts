import type { Handler } from "@acme/app";
import type { SentryConfig } from "../../hono/config";

// What every arm of the `#sentry` seam provides. Not middleware: workers build
// the client from the outer fetch's context, node holds one scope per request.
export type HandlerWrapper = (
  handler: Handler,
  config: SentryConfig,
) => Handler;

export type ClientCloser = () => Promise<void>;
