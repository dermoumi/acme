import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src/client",
  // Where turbo, the Dockerfile and the assets kit already look.
  buildDirectory: "dist",
  // Beside the node server, which imports it; .js would load as CommonJS.
  serverBuildFile:
    process.env.BUILD_TARGET === "node" ? "router.mjs" : "index.js",
} satisfies Config;
