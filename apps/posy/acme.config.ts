import { defineConfig } from "@acme/app";
import { database, defineDbConfig } from "@acme/db";
import type { Database } from "./src/server/db";
import { migrations } from "./src/server/db/migrator";
import { seedUsers } from "./src/server/db/seed";

export default defineConfig({
  kits: [
    database([
      defineDbConfig<Database>({
        binding: "DATABASE",
        migrations,
        seed: seedUsers,
      }),
    ]),
  ],
});
