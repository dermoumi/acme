import type { Dialect } from "kysely";

// Names, never values: each runtime reads what it needs off the request's env,
// so nothing is opened before one arrives. workerd uses only the binding, node
// only the url var, which it derives from the binding unless given one.
export type ResolveDialect = (
  env: unknown,
  binding: string,
  urlVar?: string,
) => Promise<Dialect>;
