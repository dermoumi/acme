/**
 * What kits hand each other, keyed by name.
 *
 * Empty here: a kit that shares something extends this by declaration merging,
 * so the key and its type arrive with the package that owns them.
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
