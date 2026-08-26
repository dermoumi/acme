import type { Dialect } from "kysely";

// Names, never values: nothing is opened before a request's env arrives.
// workerd uses only the binding, node the url var derived from it.
export type ResolveDialect = (
  env: unknown,
  binding: string,
  urlVar?: string,
) => Promise<Dialect>;
