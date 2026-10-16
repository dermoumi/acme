import type { AddHealthStatus } from "../kits/health";

/**
 * What kits hand each other, keyed by name.
 *
 * Holds what the built-in kits share; another kit that shares something
 * extends it by declaration merging.
 *
 * ```ts
 * declare module "@acme/app" {
 *   interface KitShared {
 *     withDatabase: WithDatabase;
 *   }
 * }
 * ```
 */
export interface KitShared {
  addHealthStatus: AddHealthStatus;
}
