import { defineConfig } from "@acme/app";
import { databaseKit } from "../../kit";

const config = defineConfig({
  kits: [
    databaseKit([
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
