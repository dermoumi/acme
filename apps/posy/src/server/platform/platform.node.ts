import { staticAssets } from "../assets.node";
import type { GateBindings } from "../gate";
import type { Platform } from "./contract";

// Built on first use, from the default the Dockerfile sets, and held: a node
// process serves every request from the same directory.
let files: GateBindings["ASSETS"] | undefined;

// By shape, not by truthiness: ctx.env is process.env here, so ASSETS is as
// likely to be a stray string as a fetcher something bound for a test.
function isFetcher(value: unknown): value is GateBindings["ASSETS"] {
  return typeof value === "object" && value !== null && "fetch" in value;
}

export const platform: Platform = {
  assets: (ctx) => {
    const bound = (ctx.env as Partial<GateBindings>).ASSETS;
    files ??= staticAssets(process.env.ASSETS_DIR ?? "./dist/client");

    return isFetcher(bound) ? bound : files;
  },
};
