import { serve } from "@hono/node-server";
import type { KitShutdown } from "../internal/config";
import type { Handler, Host } from "./contract";

// Under docker's ten second default, and every orchestrator has one. Docker
// sends a single SIGTERM and then SIGKILLs, so leaving is on us.
const DRAIN_MS = 8000;

type Server = ReturnType<typeof serve>;

// Once, whichever of the two paths below gets there first.
function leaving(shutdown: KitShutdown): () => void {
  let left = false;

  return () => {
    if (left) return;
    left = true;
    // A pg pool holds the loop open, so exiting is not something to leave to
    // whether anything else happens to be pending.
    // oxlint-disable-next-line unicorn/no-process-exit
    void Promise.resolve(shutdown()).finally(() => process.exit(0));
  };
}

function drain(server: Server, shutdown: KitShutdown): void {
  const leave = leaving(shutdown);

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

        // Not leave(): a shutdown that never settles must not hold the process.
        // oxlint-disable-next-line unicorn/no-process-exit
        process.exit(0);
      }, DRAIN_MS).unref();
    });
  }
}

export const host: Host = {
  serve: (handler: Handler, shutdown: KitShutdown) => {
    const server = serve(
      {
        // The same place workerd puts a deployment's values: bindings are what
        // node lacks, and kits are what answer for those.
        fetch: (request: Request) => {
          return handler.fetch(request, process.env);
        },
        port: Number(process.env.PORT ?? 3000),
        hostname: "0.0.0.0",
      },
      ({ port }) => {
        console.log(`Listening on ${port}`);
      },
    );
    drain(server, shutdown);

    return handler;
  },
};
