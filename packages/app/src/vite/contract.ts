import type { PluginOption } from "vite";

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
}
