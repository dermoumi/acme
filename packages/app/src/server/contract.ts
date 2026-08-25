import type { KitShutdown } from "../internal/config";

/**
 * What an app exports for its runtime to serve.
 */
export interface Handler {
  // An app's bindings are its own, and a host supplies whatever its runtime
  // has, so neither end of this boundary can name the other's.
  /* oxlint-disable no-explicit-any */
  fetch: (
    request: Request,
    env?: any,
    ctx?: any,
  ) => Response | Promise<Response>;
  /* oxlint-enable no-explicit-any */
}

/**
 * What every arm of the `#host` seam provides.
 *
 * A host is whatever puts an app in front of requests: the platform itself on
 * workerd, a node process listening on a port everywhere else.
 */
export interface Host {
  /**
   * Puts the app in front of requests, answering what the entry exports.
   *
   * Workers export a handler and the platform calls it; node has to listen,
   * and answers the same handler so one entry typechecks on both.
   */
  serve: (handler: Handler, shutdown: KitShutdown) => Handler;
}
