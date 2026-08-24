import { defineConfig, type Kit } from "@acme/app";
import { assetsKit } from "@acme/assets";
import { databaseKit } from "@acme/db";
import { sentryKit } from "@acme/sentry";

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
    // Ahead of the assets kit: the tunnel is a route, and a catch-all declared
    // before it would answer in its place.
    sentryKit({
      // Auth is the only sensitive thing posy handles.
      masking: "light",
      // The deploy health check probes every deploy; CI already reports its failures.
      ignoreUserAgent: "acme-ci-health-probe",
    }),
    // Last: it mounts the catch-all every unclaimed path falls through to.
    assetsKit(),
  ],
});
