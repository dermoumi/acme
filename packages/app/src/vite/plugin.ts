import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin } from "vite";
// Extension included: node loads this file directly when vite reads its config.
import { CONFIG_FILE } from "../cli/config.ts";

// Vite's convention for an id backed by no file, and what keeps other plugins
// from claiming one.
const VIRTUAL_PREFIX = "\0";

interface VirtualContext {
  /**
   * Absolute path to the app's `acme.config.ts`.
   */
  acmeConfigPath: string;
}

type VirtualModule = (context: VirtualContext) => string;

const modules: Record<string, VirtualModule> = {
  "virtual:acme-config": ({ acmeConfigPath }) => {
    if (!existsSync(acmeConfigPath)) {
      throw new Error(`acme config not found: ${acmeConfigPath}`);
    }

    const url = pathToFileURL(acmeConfigPath).href;

    return [
      `export { default } from ${JSON.stringify(acmeConfigPath)};`,
      `export function resolve(specifier) {`,
      `  return new URL(specifier, ${JSON.stringify(url)}).href;`,
      `}`,
    ].join("\n");
  },
};

/**
 * What {@link acmeVite} takes.
 */
export interface AcmeViteOptions {
  /**
   * Path to the app's config, resolved against vite's root.
   *
   * Defaults to `acme.config.ts`, which is where the CLI looks too.
   */
  config?: string;
}

/**
 * Serves the app's `acme.config.ts` as `virtual:acme-config`, so the modules
 * that need it import a flat id instead of counting `../` to the app root.
 *
 * ```ts
 * plugins: [acmeVite(), cloudflare()],
 * ```
 *
 * The virtual module default-exports the config, and exports a `resolve` that
 * turns a specifier the app wrote in that config into one that can be imported,
 * matching what the CLI hands a kit. Which config fields hold paths is each
 * kit's own business, so nothing is resolved for anyone up front.
 *
 * Inert until something imports one of its ids: an app that adds the plugin and
 * never uses it is not asked to have a config.
 *
 * TypeScript needs the app to name `@acme/app/types` in the `types` of every
 * tsconfig whose files import an id, since a program only sees the ambient
 * modules it lists.
 */
export function acmeVite(options: AcmeViteOptions = {}): Plugin {
  let acmeConfigPath = "";

  return {
    name: "@acme/app/virtual",
    // Vite's own config, not this plugin's: `root` is what the app's config
    // path is relative to, and nothing knows it until vite has resolved.
    configResolved(config) {
      acmeConfigPath = path.resolve(config.root, options.config ?? CONFIG_FILE);
    },
    resolveId(id) {
      return modules[id] ? `${VIRTUAL_PREFIX}${id}` : undefined;
    },
    load(id) {
      const name = id.startsWith(VIRTUAL_PREFIX)
        ? id.slice(VIRTUAL_PREFIX.length)
        : id;

      return modules[name]?.({ acmeConfigPath });
    },
  };
}
