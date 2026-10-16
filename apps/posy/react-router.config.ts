import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src/client",
  // Where turbo, the Dockerfile and the assets kit already look.
  buildDirectory: "dist",
  // A node host has no package.json beside it, so .js would load as CommonJS.
  serverBuildFile: "index.mjs",
} satisfies Config;
