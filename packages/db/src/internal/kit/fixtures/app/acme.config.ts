import { defineConfig } from "@acme/app";
import { database } from "../../kit";

const config = defineConfig({
  kits: [
    database([
      {
        binding: "MAIN",
        migrations: "./migrations/main.ts",
        seed: "./seed.ts",
      },
      { binding: "ANALYTICS", migrations: "./migrations/analytics.ts" },
      { binding: "RENAMED", urlVar: "RENAMED_DSN" },
    ]),
  ],
});

export default config;
