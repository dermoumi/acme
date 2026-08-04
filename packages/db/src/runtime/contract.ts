import type { Dialect } from "kysely";

export interface RuntimeOptions {
  /** Node only: which engine to build, and where it lives. */
  url?: string;
  /** Workerd only: the name of the D1 binding on `env`. */
  binding: string;
}

// Curried like @acme/rate-limiter's GetBinding, and for the same reason: node
// opens one connection per source, workerd reads a binding off every request.
export type CreateDialectResolver = (
  options: RuntimeOptions,
) => (env: unknown) => Promise<Dialect>;
