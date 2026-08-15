import { closeSentry, withSentry } from "@acme/sentry/hono";
import { serve } from "@hono/node-server";
import { createApp, sentryConfig } from "./app";
import { staticAssets } from "./assets.node";
import type { AppBindings } from "./bindings";

// One value per name, in the same positions, so a caller can destructure.
type EnvValues<Keys extends string[]> = { [Index in keyof Keys]: string };

// All of them at once: being told about the second only after fixing the first
// is a round trip the user should not have to make.
function requireEnvVars<Keys extends string[]>(...keys: Keys): EnvValues<Keys> {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`${missing.join(" and ")} must be set`);
  }

  return keys.map((key) => process.env[key]) as EnvValues<Keys>;
}

// Defaults live in the Dockerfile. Read at boot rather than on first use, since
// /health answers without a database and would pass the check without one.
const [assetsDir, databaseUrl] = requireEnvVars("ASSETS_DIR", "DATABASE_URL");

// Workers builds env per request; node has one process, so the bindings are
// built once here and reused. @acme/db opens DATABASE_URL on first use.
const env: AppBindings = {
  ASSETS: staticAssets(assetsDir),
  DATABASE_URL: databaseUrl,
  REQUIRE_AUTH: process.env.REQUIRE_AUTH,
  BASIC_AUTH: process.env.BASIC_AUTH,
  SENTRY_DSN: process.env.SENTRY_DSN,
  APP_NAME: process.env.APP_NAME,
  APP_ENV: process.env.APP_ENV,
  APP_VERSION: process.env.APP_VERSION,
  APP_REVISION: process.env.APP_REVISION,
};

const handler = withSentry(
  createApp({
    // Cloudflare sets cf-connecting-ip itself, so only node has to decide whose
    // forwarded header to believe. Empty trusts none, which is the safe default.
    trustedProxies: (process.env.TRUSTED_PROXIES ?? "")
      .split(",")
      .map((range) => range.trim())
      .filter(Boolean),
  }),
  sentryConfig,
);

const server = serve(
  {
    fetch: (request: Request) => handler.fetch(request, env),
    port: Number(process.env.PORT ?? 3000),
    hostname: "0.0.0.0",
  },
  ({ port }) => {
    console.log(`Listening on ${port}`);
  },
);

// Under docker's ten second default, and every orchestrator has one. Docker
// sends a single SIGTERM and then SIGKILLs, so leaving is on us.
const DRAIN_MS = 8000;

// Once, whichever of the two paths below gets there first.
let leaving = false;
function leave(): void {
  if (leaving) return;
  leaving = true;
  // Bounded, so an unreachable Sentry cannot outlast docker's patience.
  void closeSentry().finally(() => {
    // A pg pool holds the loop open, so exiting is not something to leave to
    // whether anything else happens to be pending.
    // oxlint-disable-next-line unicorn/no-process-exit
    process.exit(0);
  });
}

// PID 1 is exempt from the default signal dispositions, so without these the
// container ignores `docker stop` until it is killed.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    console.log("Closing...");
    // An impatient human, since docker never sends a second one.
    process.once(signal, () => {
      process.exit(130);
    });

    server.close(leave);

    // close() waits on every open socket, and a kept-alive one is idle for
    // five seconds before node reaps it. Without this, one browser sitting
    // there is enough to reach SIGKILL. http2 servers expose neither method.
    if ("closeIdleConnections" in server) {
      server.closeIdleConnections();
    }

    // Whatever is still mid-request when the deadline passes gets cut, which
    // is what SIGKILL would do anyway, except this way the drain still runs.
    setTimeout(() => {
      console.log("Closing: cutting connections still open.");
      if ("closeAllConnections" in server) {
        server.closeAllConnections();
      }

      leave();
    }, DRAIN_MS).unref();
  });
}
