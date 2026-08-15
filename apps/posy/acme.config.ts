import { defineConfig, type Kit } from "@acme/app";
import { database, defineDbConfig } from "@acme/db";
import type { Database } from "./src/server/db";
import { migrations } from "./src/server/db/migrator";
import { seedUsers } from "./src/server/db/seed";

// Everything an app owns itself, until it has a package to belong to.
const posy: Kit = {
  name: "posy",
  cli: new URL("./scripts/commands.ts", import.meta.url).href,
};

export default defineConfig({
  // Listed before the kit it requires, which the registry allows on purpose.
  kits: [
    posy,
    database([
      defineDbConfig<Database>({
        binding: "DATABASE",
        migrations,
        seed: seedUsers,
      }),
    ]),
  ],
});
