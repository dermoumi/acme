import type { Platform } from "./contract";

export const platform: Platform = {
  assets: (ctx) => {
    return ctx.env.ASSETS;
  },
};
