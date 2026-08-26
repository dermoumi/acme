import type { PluginOption } from "vite";

/**
 * What an app calls itself and which build it is.
 */
export interface AppIdentity {
  name: string;
  version: string;
  env: string;
  revision: string;
}

/**
 * What a kit's `vite` module default-exports: the plugins it contributes.
 */
export type KitVite = (context: KitViteContext) => PluginOption;

/**
 * What a kit's {@link KitVite} is handed.
 */
export interface KitViteContext {
  /**
   * The kit's own config, as the app declared it.
   */
  config: unknown;
  /**
   * Turns a specifier the app wrote in its config into one that can be
   * imported, as `KitCli.resolve` does.
   */
  resolve: (specifier: string) => string;
  /**
   * The same identity the app reports at runtime.
   */
  app: AppIdentity;
}
