import type { Host } from "./contract";

export const host: Host = {
  // The platform builds one per request and hands it to fetch.
  env: (ctx) => {
    return ctx.env as unknown;
  },
  // Exporting it is all a Worker does; the platform calls it.
  serve: (handler) => {
    return handler;
  },
};
