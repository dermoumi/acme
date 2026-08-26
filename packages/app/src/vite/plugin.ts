import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin, PluginOption } from "vite";
// Extension included: node loads this file directly when vite reads its config.
import { CONFIG_FILE, loadAcmeConfig, resolverFor } from "../cli/config.ts";
import type { AppIdentity, KitVite, KitViteContext } from "./contract.ts";

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
function stampIdentity(root: string): AppIdentity {
  const own = readPackage(root);
  const fallbackName = (own.name ?? path.basename(root)).replace(
    /^@[^/]+\//u,
    "",
  );

  const identity = {
    name: readEnv("APP_NAME", fallbackName),
    version: readEnv("APP_VERSION", own.version ?? "0.0.0"),
    env: readEnv("APP_ENV", "development"),
    revision: readEnv("APP_REVISION", "dev"),
  };

  process.env.VITE_APP_NAME = identity.name;
  process.env.VITE_APP_VERSION = identity.version;
  process.env.VITE_APP_ENV = identity.env;
  process.env.VITE_APP_REVISION = identity.revision;

  return identity;
}

// tsx: node resolves neither the barrel nor the extensionless imports here.
async function importWithTsx(url: string): Promise<unknown> {
  const { tsImport } = await import("tsx/esm/api");

  return tsImport(url, import.meta.url);
}

async function loadKitPlugins(
  file: string,
  app: AppIdentity,
): Promise<PluginOption[]> {
  const config = await loadAcmeConfig(file, importWithTsx);
  const resolve = resolverFor(pathToFileURL(file).href);

  const loading = (config.kits ?? []).map(async (kit) => {
    if (kit.vite === undefined) return;

    const loaded = (await importWithTsx(resolve(kit.vite))) as {
      default?: KitVite;
    };
    if (!loaded.default) {
      const message = `${kit.name}'s vite module must export its plugins as default`;
      throw new Error(message);
    }

    const context: KitViteContext = { config: kit.config, resolve, app };

    return loaded.default(context);
  });

  return Promise.all(loading);
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
 * The virtual module default-exports the config, and exports a `resolve` that
 * turns a specifier the app wrote in that config into one that can be imported.
 *
 * Inert until something imports one of its ids, so an app that adds the plugin
 * and never uses it is not asked to have a config.
 *
 * A module importing one of these ids reaches its types with
 * `/// <reference types="@acme/app/types" />`, the way `setupKitVars` and
 * `@acme/db/testing` do on an app's behalf. An app itself needs nothing.
 *
 * Stamps `VITE_APP_*` when called, so declare it before anything reading them.
 */
export function acmeVite(options: AcmeViteOptions = {}): PluginOption {
  let acmeConfigPath = "";
  const root = options.root ?? process.cwd();
  const app = stampIdentity(root);
  const file = path.resolve(root, options.config ?? CONFIG_FILE);
  // A missing config that was NAMED still loads, to fail loudly; one that was
  // never named just means no kits.
  const hasConfig = options.config !== undefined || existsSync(file);

  const virtual: Plugin = {
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

  return [virtual, hasConfig ? loadKitPlugins(file, app) : []];
}
