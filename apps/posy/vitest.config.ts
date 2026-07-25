import { defineConfig } from "vitest/config";

// Standalone config: the app's vite.config.ts loads the Cloudflare plugin,
// which cannot run inside vitest. DB tests run in plain node.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
