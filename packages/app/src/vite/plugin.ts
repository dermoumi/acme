import { existsSync, readFileSync } from "node:fs";
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

    // A bare specifier is answered unchanged: nothing here can resolve one, and
    // whatever the caller imports it with is what can.
    return [
      `export { default } from ${JSON.stringify(acmeConfigPath)};`,
      `export function resolve(specifier) {`,
      `  if (!specifier.startsWith(".")) return specifier;`,
      `  return new URL(specifier, ${JSON.stringify(url)}).href;`,
      `}`,
    ].join("\n");
  },
};

// An empty var has to fall back too, which `??` would not do.
function readEnv(name: string, fallback: string): string {
  const value = process.env[name];

  return value === undefined || value === "" ? fallback : value;
}

// Climbs, so a build run from a subdirectory still finds the app it belongs to.
function readPackage(from: string): { name?: string; version?: string } {
  let dir = from;
  while (!existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);
    if (parent === dir) return {};

    dir = parent;
  }

  const file = readFileSync(path.join(dir, "package.json"), "utf8");

  return JSON.parse(file) as { name?: string; version?: string };
}

// VITE_ prefixed because that is the only way a value reaches the browser.
function stampIdentity(root: string): void {
  const own = readPackage(root);
  const name = (own.name ?? path.basename(root)).replace(/^@[^/]+\//u, "");

  process.env.VITE_APP_NAME = readEnv("APP_NAME", name);
  process.env.VITE_APP_VERSION = readEnv("APP_VERSION", own.version ?? "0.0.0");
  process.env.VITE_APP_ENV = readEnv("APP_ENV", "development");
  process.env.VITE_APP_REVISION = readEnv("APP_REVISION", "dev");
}

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
  /**
   * Where the app's `package.json` is looked for, climbing to the nearest one.
   * Defaults to the working directory.
   */
  root?: string;
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
 * A module importing one of these ids reaches its types with
 * `/// <reference types="@acme/app/types" />`, the way `setupKitVars` and
 * `@acme/db/testing` do on an app's behalf. An app itself needs nothing.
 *
 * Stamps `VITE_APP_*` when called, so declare it before anything reading them.
 */
export function acmeVite(options: AcmeViteOptions = {}): Plugin {
  let acmeConfigPath = "";
  stampIdentity(options.root ?? process.cwd());

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
