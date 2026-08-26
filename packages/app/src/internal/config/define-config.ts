import type { Kit } from "./kit";

/**
 * One config per app.
 */
export interface AcmeConfig {
  /**
   * The kits this app uses, in the order they apply.
   *
   * Order is load-bearing wherever kits wrap one another, so the app writes
   * the list rather than having one assembled behind its back.
   */
  kits?: Kit[];
}

/**
 * Identity, but it types an app's config where the app writes it.
 *
 * @param config - The app's config, as the default export of `acme.config.ts`.
 */
export function defineConfig(config: AcmeConfig): AcmeConfig {
  return config;
}
