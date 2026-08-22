import { defineConfig, type Kit } from "@acme/app";
import { assetsKit } from "@acme/assets";
import { databaseKit } from "@acme/db";

// Everything an app owns itself, until it has a package to belong to.
const posy: Kit = {
  name: "@acme/posy",
  commands: "./src/commands/commands.ts",
};

export default defineConfig({
  // Listed before the kit it requires, which the registry allows on purpose.
  kits: [
    posy,
    databaseKit([
      {
        binding: "DATABASE",
        migrations: "./src/server/db/migrator.ts",
        seed: "./src/server/db/seed.ts",
      },
    ]),
    // Last: it mounts the catch-all every unclaimed path falls through to.
    assetsKit(),
  ],
});
