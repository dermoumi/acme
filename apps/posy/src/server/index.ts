import { withSentry } from "@acme/sentry/hono";
import { D1Dialect } from "kysely-d1";
import { createApp } from "./app";

export const app = createApp((env) => {
  if (!env.DB) throw new Error("no D1 binding on this environment");
  return new D1Dialect({ database: env.DB });
});

// Auth is the only sensitive thing here, so mask keys but keep query data.
export default withSentry(app, { masking: "light" });
