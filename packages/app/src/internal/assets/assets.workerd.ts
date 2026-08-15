import type { AssetsBinding, ResolveAssets } from "./contract";

export const resolveAssets: ResolveAssets = (env, options = {}) => {
  const { binding = "ASSETS" } = options;
  const assets = (env as Record<string, unknown>)[binding];
  if (!assets) {
    throw new Error(`no assets binding named "${binding}" on this environment`);
  }

  return assets as AssetsBinding;
};
