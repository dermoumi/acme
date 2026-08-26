import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AcmeConfig } from "../internal/config";

export const CONFIG_FILE = "acme.config.ts";
const DEFAULT_CONFIG: Readonly<AcmeConfig> = Object.freeze({});

/**
 * Reads an app's config from a file. Shared by every kit's CLI.
 *
 * An absent `acme.config.ts` answers an empty config. A file named explicitly
 * must exist.
 *
 * @param file Path to the config. Defaults to `acme.config.ts` here.
 */
// Declaring nothing is a config too, but naming a file says you meant it, so
// only an unnamed missing one answers nothing.
function configFile(file?: string): string | undefined {
  const resolved = path.resolve(file ?? CONFIG_FILE);

  return !existsSync(resolved) && file === undefined ? undefined : resolved;
}

/**
 * Where an app's config is, as a URL.
 *
 * The base a specifier written inside that config resolves against. Answers
 * nothing when there is no config to read.
 *
 * @param file Path to the config. Defaults to `acme.config.ts` here.
 */
export function acmeConfigUrl(file?: string): string | undefined {
  const resolved = configFile(file);

  return resolved === undefined ? undefined : pathToFileURL(resolved).href;
}

/**
 * Turns a specifier an app wrote in its config into one that can be imported.
 */
export type Resolve = (specifier: string) => string;

export function resolverFor(configUrl: string | undefined): Resolve {
  return (specifier) => {
    if (URL.canParse(specifier)) {
      return specifier;
    }

    if (configUrl === undefined) {
      const message = `cannot resolve "${specifier}": no config file was read`;
      throw new Error(message);
    }

    if (specifier.startsWith(".")) {
      return new URL(specifier, configUrl).href;
    }

    // Node's resolver, run from the app: @acme/app declares no kit, so looking
    // for one beside itself finds nothing under pnpm.
    const specifierPath = createRequire(configUrl).resolve(specifier);
    return pathToFileURL(specifierPath).href;
  };
}

export async function loadAcmeConfig(
  file?: string,
  load: (url: string) => Promise<unknown> = (url) => import(url),
): Promise<AcmeConfig> {
  const resolved = configFile(file);
  if (resolved === undefined) {
    return DEFAULT_CONFIG;
  }

  const configFilePath = pathToFileURL(resolved).href;
  const loaded = (await load(configFilePath).catch((cause: unknown) => {
    throw new Error(`could not read ${resolved}`, { cause });
  })) as { default?: AcmeConfig };

  if (!loaded.default) {
    throw new Error(`${resolved} must export a config as its default`);
  }

  return loaded.default;
}
