import type { CaptureError, RenderErrorPage } from "../server/error-page";

/**
 * What kits hand each other, keyed by name.
 *
 * `@acme/app` reads `captureError` and `renderErrorPage` itself; a kit that
 * shares anything else extends this by declaration merging.
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
  /**
   * The project's page for an error status. See {@link RenderErrorPage}.
   */
  renderErrorPage: RenderErrorPage;
}
