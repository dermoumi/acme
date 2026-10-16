import type { CaptureError } from "../server/error-page";

/**
 * What kits hand each other, keyed by name.
 *
 * `@acme/app` reads `captureError` itself; a kit that shares anything else
 * extends this by declaration merging.
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
  /**
   * Where `onError` reports what it caught. See {@link CaptureError}.
   */
  captureError: CaptureError;
}
