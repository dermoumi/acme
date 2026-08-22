import type { Assets } from "./contract";

export const assets: Assets = {
  // The binding applies the app's configured not_found_handling itself, so the
  // shell behind an unclaimed path is the platform's to serve, not ours.
  handler: (ctx) => {
    return ctx.env.ASSETS.fetch(ctx.req.raw);
  },
};
