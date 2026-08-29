import { defineConfig, type Kit } from "@acme/app";
import { assetsKit } from "@acme/assets";
import { databaseKit } from "@acme/db";
import { rateLimiterKit } from "@acme/rate-limiter";
import { sentryKit } from "@acme/sentry";
import type { AppBindings } from "./src/server/bindings";

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
    rateLimiterKit<AppBindings>({
      // Mirror wrangler.jsonc, which no runtime reads back.
      budgets: [
        { binding: "RATE_LIMIT_LOGIN", limit: 10, periodSeconds: 60 },
        { binding: "RATE_LIMIT_SENTRY", limit: 60, periodSeconds: 60 },
      ],
      // POST only keeps the per-load GET uncapped; /sentry exact, /* would
      // double. The tunnel itself is the sentry kit's, mounted behind this.
      routes: [
        { method: "POST", path: "/session", binding: "RATE_LIMIT_LOGIN" },
        { method: "POST", path: "/sentry", binding: "RATE_LIMIT_SENTRY" },
      ],
    }),
    // Ahead of the assets kit: the tunnel is a route, and a catch-all declared
    // before it would answer in its place.
    sentryKit({
      // Auth is the only sensitive thing posy handles.
      masking: "light",
      // The deploy check probes every deploy; CI already reports its failures.
      ignoreUserAgent: "acme-ci-health-probe",
    }),
    // Last: it mounts the catch-all every unclaimed path falls through to.
    assetsKit(),
  ],
});
