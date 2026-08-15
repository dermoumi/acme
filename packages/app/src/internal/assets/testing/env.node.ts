// serveStatic resolves root against the process cwd, which vitest leaves at
// the package root.
export const assetsEnv: unknown = {
  ASSETS_DIR: "./src/internal/assets/fixtures/assets",
};
