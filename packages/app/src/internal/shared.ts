/**
 * What kits hand each other, keyed by name.
 *
 * Empty here: a kit that shares something extends it by declaration merging.
 *
 * ```ts
 * declare module "@acme/app" {
 *   interface KitShared {
 *     withDatabase: WithDatabase;
 *   }
 * }
 * ```
 */
// oxlint-disable-next-line no-empty-object-type
export interface KitShared {}
