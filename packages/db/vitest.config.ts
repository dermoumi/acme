import { defineConfig } from "vitest/config";

// One include per project, so the same test file runs on every runtime it fits.
const include = ["src/**/*.test.ts"];

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      exclude: ["src/testing/**", "*.config.ts"],
    },
    projects: [{ test: { name: "node", include } }],
  },
});
