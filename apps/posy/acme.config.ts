import { defineConfig, type Kit } from "@acme/app";
import { database } from "@acme/db";
import { migrations } from "./src/server/db/migrator";
import { seedUsers } from "./src/server/db/seed";

// Everything an app owns itself, until it has a package to belong to.
const posy: Kit = {
  name: "posy",
  cli: new URL("./src/commands/commands.ts", import.meta.url).href,
};

export default defineConfig({
  // Listed before the kit it requires, which the registry allows on purpose.
  kits: [
    posy,
    database([{ binding: "DATABASE", migrations, seed: seedUsers }]),
  ],
});
