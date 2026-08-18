import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    silent: "passed-only",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcovonly"],
      exclude: ["*.config.ts"],
    },
  },
});
