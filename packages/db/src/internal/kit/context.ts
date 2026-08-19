import { type Accessors, openDbAccessors } from "../db";
import type { DatabaseConfig } from "./kit";

export interface DatabaseContext {
  accessors: Accessors;
}

// Keyed on the array `databaseKit` answered, one per declaration, so this holds
// without a handle to pass around and a second build opens nothing new.
const held = new WeakMap<readonly DatabaseConfig[], DatabaseContext>();

export function contextFor(config: readonly DatabaseConfig[]): DatabaseContext {
  const found = held.get(config);
  if (found !== undefined) {
    return found;
  }

  const context: DatabaseContext = { accessors: openDbAccessors(config) };
  held.set(config, context);

  return context;
}
