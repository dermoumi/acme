import type { Assets } from "./contract";

export const assets: Assets = {
  // No directory to resolve: the platform holds the files, and the binding
  // applies the app's configured not_found_handling itself.
  createHandler: () => {
    return (ctx) => {
      return ctx.env.ASSETS.fetch(ctx.req.raw);
    };
  },
};
