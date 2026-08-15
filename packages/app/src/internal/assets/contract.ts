/**
 * What app code calls on `env.ASSETS`, whatever the runtime.
 *
 * Structural rather than Cloudflare's `Fetcher`: node has no platform type to
 * borrow, and this is the whole surface app code uses.
 */
export interface AssetsBinding {
  fetch: (request: Request) => Promise<Response>;
}

/** The names on the environment, for apps that do not take the defaults. */
export interface AssetsOptions {
  /** Binding the platform supplies the assets under. Defaults to `ASSETS`. */
  binding?: string;
  /** Variable naming the directory to serve. Defaults to `<binding>_DIR`. */
  dirVar?: string;
}

/**
 * Answers with the environment's assets binding, building one on hosts where
 * the platform supplies none.
 *
 * Names, never values: each runtime reads what it needs off the env it is
 * handed, so nothing is opened before one arrives. workerd uses only the
 * binding, node only the directory variable.
 */
export type ResolveAssets = (
  env: unknown,
  options?: AssetsOptions,
) => AssetsBinding;
