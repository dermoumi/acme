import type { GateBindings } from "../gate";
import { staticAssets } from "../assets.node";
import type { Platform } from "./contract";

// Built on first use, from the default the Dockerfile sets, and held: a node
// process serves every request from the same directory.
let files: GateBindings["ASSETS"] | undefined;

export const platform: Platform = {
  // ASSETS is declared required, but a node process has no bindings at all;
  // one that is bound wins, letting a test serve fixtures off no filesystem.
  assets: (ctx) => {
    const bound = (ctx.env as Partial<GateBindings>).ASSETS;
    files ??= staticAssets(process.env.ASSETS_DIR ?? "./dist/client");

    return bound ?? files;
  },
};
