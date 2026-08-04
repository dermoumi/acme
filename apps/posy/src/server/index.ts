import { withSentry } from "@acme/sentry/hono";
import { createApp, sentryConfig } from "./app";

export const app = createApp();

export default withSentry(app, sentryConfig);
